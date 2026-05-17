// ─────────────────────────────────────────────────────────
//  src/mock/handlers.ts
//  MSW request handlers — intercepta /api/* en local.
//
//  CÓMO CAMBIAR EL USUARIO ACTIVO:
//  Edita src/mock/db.json → campo "currentUser"
//  (cambia "id" al de cualquier entrada de "appUsers").
//
//  MODELO DE IDENTIDAD:
//  ÚNICA fuente de identidad operativa: appUsers[] con IDs "au-xxx".
//  users[] existe solo como catálogo legacy; NO referenciar desde
//  workItems/projects/logs. Toda asignación usa appUsers.id.
// ─────────────────────────────────────────────────────────

import { http, HttpResponse } from "msw";
import type {
  Project,
  WorkItem,
  ActivityLogEntry,
  Evidence,
  EvidencePayload,
  PatchWorkItemStatePayload,
  AppRole,
  ActionRequest,
  Team,
  AppUser,
} from "../types/domain";

// ── Carga del mock db ────────────────────────────────────
// Importamos el JSON estático (Vite lo bundlea como módulo).
// Para editar datos en caliente recarga la app (HMR).
import db from "./db.json";

// Clon mutable en memoria — se pierde al recargar (intencional para dev).
const store = structuredClone(db) as typeof db;

// ── Helpers ──────────────────────────────────────────────
const ok = <T>(data: T) => HttpResponse.json(data);
const err = (status: number, message: string) =>
  HttpResponse.json({ error: message }, { status });

/** Visibilidad de proyectos según rol del usuario actual */
function visibleProjects(): Project[] {
  const user = store.currentUser as AppUser;
  const role = (user.role ?? (user as unknown as { roles: string[] }).roles?.[0]) as AppRole;
  const userTeamIds = new Set(user.teamIds ?? []);

  // Admin → ve absolutamente todo (bypass total)
  if (role === "Admin") {
    return store.projects as Project[];
  }

  // Filtro base por visibilityMode:
  //   "Enterprise"  → visible para todos los roles autenticados
  //   "Restricted"  → solo si el usuario pertenece a alguno de los visibilityTeamIds
  //   Sin campo     → trata como "Restricted" usando proveedor/area como fallback
  const canSeeByVisibility = (p: Project): boolean => {
    const mode = p.visibilityMode ?? "Restricted";
    if (mode === "Enterprise") return true;
    // Restricted: intersección entre teamIds del usuario y visibilityTeamIds del proyecto
    const visTeams = p.visibilityTeamIds ?? [];
    if (visTeams.length === 0) {
      // Sin equipos configurados → sólo IT y Admin (ya filtrados antes)
      return role === "IT AirEuropa";
    }
    return visTeams.some((tid) => userTeamIds.has(tid));
  };

  return (store.projects as Project[]).filter(canSeeByVisibility);
}

/** Valida la transición y devuelve el objeto transition o null si inválida */
function findTransition(fromStateId: string, toStateId: string) {
  return store.transitions.find(
    (t) => t.fromStateId === fromStateId && t.toStateId === toStateId,
  ) ?? null;
}

/** Comprueba si el usuario actual tiene uno de los roles requeridos */
function currentUserHasRole(allowedRoles: string[]): boolean {
  const cu = store.currentUser as AppUser;
  const role = cu.role ?? (cu as unknown as { roles: string[] }).roles?.[0] ?? "";
  return allowedRoles.includes(role);
}

// Mapa App-state → Jira state (para simular la sincronización)
const JIRA_STATE_MAP: Record<string, string> = {
  "st-new": "Backlog",
  "st-ref": "Refinement",
  "st-prog": "In Progress",
  "st-blk": "Blocked",
  "st-rft": "Done",
  "st-test": "Testing",
  "st-acc": "Accepted",
  "st-cls": "Closed",
};

/** Genera un ID simple basado en timestamp */
const genId = (prefix: string) => `${prefix}-${Date.now()}`;

/**
 * Calcula el progreso de una Épica (Project) a partir de sus WorkItems.
 * progress = count(workItems con stateId=st-cls) / count(workItems) * 100
 */
const computeProjectProgress = (projectId: string): number => {
  const items = (store.workItems as WorkItem[]).filter((w) => w.projectId === projectId);
  if (!items.length) return 0;
  const closed = items.filter((w) => w.stateId === "st-cls").length;
  return Math.round((closed / items.length) * 100);
};

// ── Handlers ─────────────────────────────────────────────
export const handlers = [

  // ── GET /api/business-areas ──────────────────────────
  http.get("/api/business-areas", () => ok(store.businessAreas)),

  // ── GET /api/teams ───────────────────────────────────
  http.get("/api/teams", ({ request }) => {
    const url      = new URL(request.url);
    const type     = url.searchParams.get("type")     ?? "";
    const query    = url.searchParams.get("query")    ?? "";
    const isActive = url.searchParams.get("isActive") ?? "";

    let list = (store.teams as Team[]);
    if (type)     list = list.filter((t) => t.type === type);
    if (isActive) list = list.filter((t) => t.isActive === (isActive === "true"));
    if (query)    list = list.filter((t) => t.name.toLowerCase().includes(query.toLowerCase()));

    return ok(list);
  }),

  // ── POST /api/teams ──────────────────────────────────
  http.post("/api/teams", async ({ request }) => {
    if (!currentUserHasRole(["Admin"])) return err(403, "Solo Admin puede crear equipos");
    const body = await request.json() as { name?: string; type?: string; isActive?: boolean };
    const name = (body.name ?? "").trim();
    if (!name) return err(400, "El nombre del equipo es obligatorio");
    if (!body.type) return err(400, "El tipo de equipo es obligatorio");
    if (!["Area", "Provider", "Internal"].includes(body.type)) {
      return err(400, `Tipo inválido: '${body.type}'. Debe ser Area, Provider o Internal`);
    }
    const duplicate = (store.teams as Team[]).find(
      (t) => t.name.toLowerCase() === name.toLowerCase(),
    );
    if (duplicate) return err(409, `Ya existe un equipo con nombre '${name}'`);
    const newTeam: Team = {
      id:       `team-${name.toLowerCase().replace(/\s+/g, "-")}-${Date.now().toString(36)}`,
      name,
      type:     body.type as Team["type"],
      isActive: body.isActive ?? true,
    };
    (store.teams as Team[]).push(newTeam);
    (store.auditLog as unknown[]).push({
      id: genId("audit"), category: "Team", action: "TEAM_CREATED",
      who: store.currentUser.id, whoRole: store.currentUser.roles[0],
      at: new Date().toISOString(), entityType: "Team", entityId: newTeam.id,
      after: newTeam, description: `Equipo '${newTeam.name}' (${newTeam.type}) creado`,
    });
    return HttpResponse.json(newTeam, { status: 201 });
  }),

  // ── PATCH /api/teams/:id ─────────────────────────────
  http.patch("/api/teams/:id", async ({ params, request }) => {
    if (!currentUserHasRole(["Admin"])) return err(403, "Solo Admin puede editar equipos");
    const idx = (store.teams as Team[]).findIndex((t) => t.id === params.id);
    if (idx === -1) return err(404, "Equipo no encontrado");
    const body = await request.json() as Partial<Team>;
    if (body.name !== undefined) {
      const trimmed = (body.name ?? "").trim();
      if (!trimmed) return err(400, "El nombre no puede estar vacío");
      const dup = (store.teams as Team[]).find(
        (t) => t.name.toLowerCase() === trimmed.toLowerCase() && t.id !== params.id,
      );
      if (dup) return err(409, `Ya existe un equipo con nombre '${trimmed}'`);
      (store.teams as Team[])[idx].name = trimmed;
    }
    if (body.type !== undefined)     (store.teams as Team[])[idx].type     = body.type;
    if (body.isActive !== undefined) (store.teams as Team[])[idx].isActive = body.isActive;
    const updated = (store.teams as Team[])[idx];
    (store.auditLog as unknown[]).push({
      id: genId("audit"), category: "Team", action: "TEAM_UPDATED",
      who: store.currentUser.id, whoRole: store.currentUser.roles[0],
      at: new Date().toISOString(), entityType: "Team", entityId: updated.id,
      after: updated, description: `Equipo '${updated.name}' actualizado`,
    });
    return ok(updated);
  }),

  // ── POST /api/teams/:id/activate ─────────────────────
  http.post("/api/teams/:id/activate", ({ params }) => {
    if (!currentUserHasRole(["Admin"])) return err(403, "Solo Admin");
    const team = (store.teams as Team[]).find((t) => t.id === params.id);
    if (!team) return err(404, "Equipo no encontrado");
    team.isActive = true;
    (store.auditLog as unknown[]).push({
      id: genId("audit"), category: "Team", action: "TEAM_ACTIVATED",
      who: store.currentUser.id, whoRole: store.currentUser.roles[0],
      at: new Date().toISOString(), entityType: "Team", entityId: team.id,
      description: `Equipo '${team.name}' activado`,
    });
    return ok(team);
  }),

  // ── POST /api/teams/:id/deactivate ───────────────────
  http.post("/api/teams/:id/deactivate", ({ params }) => {
    if (!currentUserHasRole(["Admin"])) return err(403, "Solo Admin");
    const team = (store.teams as Team[]).find((t) => t.id === params.id);
    if (!team) return err(404, "Equipo no encontrado");
    team.isActive = false;
    (store.auditLog as unknown[]).push({
      id: genId("audit"), category: "Team", action: "TEAM_DEACTIVATED",
      who: store.currentUser.id, whoRole: store.currentUser.roles[0],
      at: new Date().toISOString(), entityType: "Team", entityId: team.id,
      description: `Equipo '${team.name}' desactivado`,
    });
    return ok(team);
  }),

  // ── GET /api/app-users ───────────────────────────────
  // Endpoint orientado a selección en cascada para asignaciones.
  // Soporta filtro por role + teamId (ambos opcionales).
  http.get("/api/app-users", ({ request }) => {
    const url      = new URL(request.url);
    const query    = url.searchParams.get("query")    ?? "";
    const role     = url.searchParams.get("role")     ?? "";
    const teamId   = url.searchParams.get("teamId")   ?? "";
    const isActive = url.searchParams.get("isActive") ?? "";

    let list = (store.appUsers as AppUser[]);

    // Nunca exponer Invitados como candidatos de asignación
    list = list.filter((u) => u.role !== "Invitado");

    if (role)     list = list.filter((u) => u.role === role);
    if (teamId)   list = list.filter((u) => (u.teamIds as string[]).includes(teamId));
    if (isActive) list = list.filter((u) => u.isActive === (isActive === "true"));
    if (query) {
      const q = query.toLowerCase();
      list = list.filter(
        (u) => u.displayName.toLowerCase().includes(q) || u.email.toLowerCase().includes(q),
      );
    }

    return ok(list);
  }),

  // ── GET /api/app-users/:id ───────────────────────────
  http.get("/api/app-users/:id", ({ params }) => {
    const user = (store.appUsers as AppUser[]).find((u) => u.id === params.id);
    if (!user) return err(404, "Usuario no encontrado");
    return ok(user);
  }),

  // ── POST /api/app-users ──────────────────────────────
  http.post("/api/app-users", async ({ request }) => {
    if (!currentUserHasRole(["Admin"])) return err(403, "Solo Admin puede crear usuarios");
    const body = await request.json() as Partial<AppUser>;
    if (!body.displayName || !body.email || !body.upn || !body.role) {
      return err(400, "displayName, email, upn y role son obligatorios");
    }
    // Proveedor debe tener al menos un team de tipo Provider
    if (body.role === "Proveedor" && (!body.teamIds || body.teamIds.length === 0)) {
      return err(400, "Un usuario Proveedor debe pertenecer al menos a un equipo de tipo Provider");
    }
    const newUser: AppUser = {
      id:          genId("au"),
      displayName: body.displayName,
      email:       body.email,
      upn:         body.upn,
      role:        body.role as AppRole,
      teamIds:     body.teamIds ?? [],
      isActive:    body.isActive ?? true,
      createdOn:   new Date().toISOString(),
      updatedOn:   new Date().toISOString(),
    };
    (store.appUsers as AppUser[]).push(newUser);
    return HttpResponse.json(newUser, { status: 201 });
  }),

  // ── PATCH /api/app-users/:id ─────────────────────────
  http.patch("/api/app-users/:id", async ({ params, request }) => {
    if (!currentUserHasRole(["Admin"])) return err(403, "Solo Admin puede editar usuarios");
    const idx = (store.appUsers as AppUser[]).findIndex((u) => u.id === params.id);
    if (idx === -1) return err(404, "Usuario no encontrado");
    const body = await request.json() as Partial<AppUser>;
    Object.assign((store.appUsers as AppUser[])[idx], body, { updatedOn: new Date().toISOString() });
    return ok((store.appUsers as AppUser[])[idx]);
  }),

  // ── POST /api/app-users/:id/activate ─────────────────
  http.post("/api/app-users/:id/activate", ({ params }) => {
    if (!currentUserHasRole(["Admin"])) return err(403, "Solo Admin");
    const user = (store.appUsers as AppUser[]).find((u) => u.id === params.id);
    if (!user) return err(404, "Usuario no encontrado");
    user.isActive = true;
    user.updatedOn = new Date().toISOString();
    return ok(user);
  }),

  // ── POST /api/app-users/:id/deactivate ───────────────
  http.post("/api/app-users/:id/deactivate", ({ params }) => {
    if (!currentUserHasRole(["Admin"])) return err(403, "Solo Admin");
    const user = (store.appUsers as AppUser[]).find((u) => u.id === params.id);
    if (!user) return err(404, "Usuario no encontrado");
    user.isActive = false;
    user.updatedOn = new Date().toISOString();
    return ok(user);
  }),

  // ── GET /api/providers ───────────────────────────────
  http.get("/api/providers", () => ok(store.providers)),

  // ── GET /api/states ──────────────────────────────────
  http.get("/api/states", () => ok([...store.states].sort((a, b) => a.order - b.order))),

  // ── GET /api/users ───────────────────────────────────
  // Devuelve los usuarios del sistema (para people-pickers / asignación)
  // Proveedor: solo ve usuarios de su proveedor + IT
  http.get("/api/users", ({ request }) => {
    const url      = new URL(request.url);
    const roleFilter   = url.searchParams.get("role") ?? "";
    const providerFilter = url.searchParams.get("providerId") ?? "";

    const currentUser = store.currentUser as AppUser;
    const currentRoles = [currentUser.role as AppRole];

    let users = [...store.appUsers];

    // RBAC: Proveedor solo ve usuarios de sus equipos provider + IT (no otros proveedores)
    if (currentRoles.includes("Proveedor") && !currentRoles.includes("Admin")) {
      const myTeamIds = new Set(currentUser.teamIds ?? []);
      users = users.filter((u) => {
        if (u.role === "IT AirEuropa" || u.role === "Admin") return true;
        return (u.teamIds ?? []).some((tid) => myTeamIds.has(tid));
      });
    }

    if (roleFilter)     users = users.filter((u) => u.role === roleFilter);
    // providerFilter: appUsers no tienen providerId, se filtra por teamIds de tipo Provider
    if (providerFilter) {
      const provTeam = store.teams.find((t) =>
        store.projects.some((p) => p.providerId === providerFilter && p.providerTeamId === t.id),
      );
      if (provTeam) {
        users = users.filter((u) => (u.teamIds ?? []).includes(provTeam.id));
      }
    }

    // Normalizar a User[] (roles: AppRole[]) aunque el store guarde AppUser (role singular)
    return ok(users.map((u) => ({
      id:            u.id,
      displayName:   u.displayName,
      email:         u.email || u.upn || "",
      roles:         [u.role as AppRole],
      // campos opcionales usados por AssignUserModal para filtrar por proveedor
      teamIds:       u.teamIds ?? [],
      providerId:    undefined,
      businessAreaId: undefined,
    })));
  }),



  // ── GET /api/transitions ─────────────────────────────
  http.get("/api/transitions", () => ok(store.transitions)),

  // ── POST /api/transitions ────────────────────────────
  http.post("/api/transitions", async ({ request }) => {
    if (!currentUserHasRole(["Admin"])) return err(403, "Solo Admin puede gestionar transiciones");
    const body = await request.json() as Partial<typeof store.transitions[0]>;
    if (!body.fromStateId || !body.toStateId) return err(400, "fromStateId y toStateId son obligatorios");
    if (!body.allowedRoles || body.allowedRoles.length === 0) return err(400, "allowedRoles no puede estar vacío");
    const dup = store.transitions.find(
      (t) => t.fromStateId === body.fromStateId && t.toStateId === body.toStateId,
    );
    if (dup) return err(409, `Ya existe una transición ${body.fromStateId} → ${body.toStateId}`);
    const newT = {
      id: `tr-${body.fromStateId?.replace("st-", "")}-${body.toStateId?.replace("st-", "")}-${Date.now().toString(36)}`,
      fromStateId: body.fromStateId,
      toStateId: body.toStateId,
      allowedRoles: body.allowedRoles ?? [],
      assignToRole: body.assignToRole ?? null,
      autoAssignTeam: body.autoAssignTeam ?? false,
      requireUserAssignment: body.requireUserAssignment ?? false,
      requireEvidence: body.requireEvidence ?? false,
      evidenceTypes: body.evidenceTypes ?? [],
      requireComment: body.requireComment ?? false,
      confirmMove: body.confirmMove ?? false,
    };
    (store.transitions as typeof store.transitions).push(newT as typeof store.transitions[0]);
    (store.auditLog as unknown[]).push({
      id: genId("audit"), category: "StateMachine", action: "TRANSITION_CREATED",
      who: store.currentUser.id, whoRole: store.currentUser.roles[0],
      at: new Date().toISOString(), entityType: "Transition", entityId: newT.id,
      after: newT, description: `Transición ${newT.fromStateId} → ${newT.toStateId} creada`,
    });
    return HttpResponse.json(newT, { status: 201 });
  }),

  // ── PATCH /api/transitions/:id ───────────────────────
  http.patch("/api/transitions/:id", async ({ params, request }) => {
    if (!currentUserHasRole(["Admin"])) return err(403, "Solo Admin puede gestionar transiciones");
    const idx = store.transitions.findIndex((t) => t.id === params.id);
    if (idx === -1) return err(404, "Transición no encontrada");
    const before = { ...store.transitions[idx] };
    const body = await request.json() as Partial<typeof store.transitions[0]>;
    // Validar no duplicado si cambian fromStateId/toStateId
    if (body.fromStateId || body.toStateId) {
      const newFrom = body.fromStateId ?? store.transitions[idx].fromStateId;
      const newTo   = body.toStateId   ?? store.transitions[idx].toStateId;
      const dup = store.transitions.find(
        (t, i) => i !== idx && t.fromStateId === newFrom && t.toStateId === newTo,
      );
      if (dup) return err(409, `Ya existe una transición ${newFrom} → ${newTo}`);
    }
    Object.assign(store.transitions[idx], body);
    const updated = store.transitions[idx];
    (store.auditLog as unknown[]).push({
      id: genId("audit"), category: "StateMachine", action: "TRANSITION_UPDATED",
      who: store.currentUser.id, whoRole: store.currentUser.roles[0],
      at: new Date().toISOString(), entityType: "Transition", entityId: updated.id,
      before, after: updated, description: `Transición ${updated.fromStateId} → ${updated.toStateId} actualizada`,
    });
    return ok(updated);
  }),

  // ── DELETE /api/transitions/:id ──────────────────────
  http.delete("/api/transitions/:id", ({ params }) => {
    if (!currentUserHasRole(["Admin"])) return err(403, "Solo Admin puede gestionar transiciones");
    const idx = store.transitions.findIndex((t) => t.id === params.id);
    if (idx === -1) return err(404, "Transición no encontrada");
    const removed = store.transitions[idx];
    store.transitions.splice(idx, 1);
    (store.auditLog as unknown[]).push({
      id: genId("audit"), category: "StateMachine", action: "TRANSITION_DELETED",
      who: store.currentUser.id, whoRole: store.currentUser.roles[0],
      at: new Date().toISOString(), entityType: "Transition", entityId: removed.id,
      before: removed, description: `Transición ${removed.fromStateId} → ${removed.toStateId} eliminada`,
    });
    return new HttpResponse(null, { status: 204 });
  }),

  // ── POST /api/transitions/reset-defaults ─────────────
  http.post("/api/transitions/reset-defaults", () => {
    if (!currentUserHasRole(["Admin"])) return err(403, "Solo Admin puede restaurar la máquina de estados");
    const before = JSON.parse(JSON.stringify(store.transitions));
    const baseline = [
      { id: "tr-new-ref",   fromStateId: "st-new",  toStateId: "st-ref",  allowedRoles: ["Admin","IT AirEuropa"], assignToRole: ["IT AirEuropa"], autoAssignTeam: true,  requireUserAssignment: false, requireEvidence: false, evidenceTypes: [], requireComment: false, confirmMove: false },
      { id: "tr-ref-prog",  fromStateId: "st-ref",  toStateId: "st-prog", allowedRoles: ["Admin","IT AirEuropa"], assignToRole: ["Proveedor"],    autoAssignTeam: true,  requireUserAssignment: true,  requireEvidence: false, evidenceTypes: [], requireComment: false, confirmMove: false },
      { id: "tr-prog-rft",  fromStateId: "st-prog", toStateId: "st-rft",  allowedRoles: ["Admin","Proveedor"],    assignToRole: ["IT AirEuropa"], autoAssignTeam: true,  requireUserAssignment: true,  requireEvidence: true,  evidenceTypes: ["link","comment","file"], requireComment: false, confirmMove: false },
      { id: "tr-rft-test",  fromStateId: "st-rft",  toStateId: "st-test", allowedRoles: ["Admin","IT AirEuropa"], assignToRole: ["Usuario"],      autoAssignTeam: true,  requireUserAssignment: true,  requireEvidence: false, evidenceTypes: [], requireComment: false, confirmMove: false },
      { id: "tr-test-acc",  fromStateId: "st-test", toStateId: "st-acc",  allowedRoles: ["Admin","IT AirEuropa","Usuario"], assignToRole: ["IT AirEuropa"], autoAssignTeam: true, requireUserAssignment: false, requireEvidence: true, evidenceTypes: ["comment"], requireComment: false, confirmMove: false },
      { id: "tr-acc-cls",   fromStateId: "st-acc",  toStateId: "st-cls",  allowedRoles: ["Admin","IT AirEuropa"], assignToRole: ["IT AirEuropa"], autoAssignTeam: true,  requireUserAssignment: false, requireEvidence: false, evidenceTypes: [], requireComment: true, confirmMove: true },
      { id: "tr-prog-blk",  fromStateId: "st-prog", toStateId: "st-blk",  allowedRoles: ["Admin","IT AirEuropa","Proveedor"], assignToRole: ["IT AirEuropa"], autoAssignTeam: true, requireUserAssignment: false, requireEvidence: false, evidenceTypes: [], requireComment: true, confirmMove: false },
      { id: "tr-blk-prog",  fromStateId: "st-blk",  toStateId: "st-prog", allowedRoles: ["Admin","IT AirEuropa"], assignToRole: ["Proveedor"],    autoAssignTeam: true,  requireUserAssignment: true,  requireEvidence: false, evidenceTypes: [], requireComment: false, confirmMove: false },
    ];
    store.transitions.splice(0, store.transitions.length, ...(baseline as typeof store.transitions));
    (store.auditLog as unknown[]).push({
      id: genId("audit"), category: "StateMachine", action: "TRANSITION_RESET_DEFAULTS",
      who: store.currentUser.id, whoRole: store.currentUser.roles[0],
      at: new Date().toISOString(), entityType: "Transition", entityId: "ALL",
      before, after: baseline, description: "Máquina de estados restaurada a configuración baseline enterprise",
    });
    return ok(store.transitions);
  }),

  // ── GET /api/projects ────────────────────────────────
  http.get("/api/projects", ({ request }) => {
    const url = new URL(request.url);
    const areaId = url.searchParams.get("areaId") ?? "";
    const year = url.searchParams.get("year") ?? "";
    const query = url.searchParams.get("query")?.toLowerCase() ?? "";
    const status = url.searchParams.get("status") ?? "";
    const category = url.searchParams.get("category") ?? "";
    const providerId = url.searchParams.get("providerId") ?? "";
    const deliveryOwnerType = url.searchParams.get("deliveryOwnerType") ?? "";

    let list = visibleProjects();

    if (areaId)            list = list.filter((p) => p.businessAreaId === areaId);
    if (status)            list = list.filter((p) => p.status === status);
    if (category)          list = list.filter((p) => p.category === category);
    if (providerId)        list = list.filter((p) => p.providerId === providerId);
    if (deliveryOwnerType) list = list.filter((p) => p.deliveryOwnerType === deliveryOwnerType);
    if (year)              list = list.filter((p) => p.startDate.startsWith(year) || p.endDate.startsWith(year));
    if (query)             list = list.filter((p) => p.name.toLowerCase().includes(query) || p.code.toLowerCase().includes(query));

    return ok(list.map((p) => ({ ...p, progress: computeProjectProgress(p.id) })));
  }),

  // ── GET /api/projects/:id ─────────────────────────────
  http.get("/api/projects/:id", ({ params }) => {
    const project = (store.projects as Project[]).find((p) => p.id === params.id);
    if (!project) return err(404, "Proyecto no encontrado");

    // Comprobar visibilidad
    const visible = visibleProjects();
    if (!visible.some((p) => p.id === project.id)) return err(403, "Sin acceso a este proyecto");

    return ok({ ...project, progress: computeProjectProgress(project.id) });
  }),

  // ── GET /api/projects/:id/workitems ───────────────────
  http.get("/api/projects/:id/workitems", ({ params }) => {
    const project = (store.projects as Project[]).find((p) => p.id === params.id);
    if (!project) return err(404, "Proyecto no encontrado");

    const visible = visibleProjects();
    if (!visible.some((p) => p.id === project.id)) return err(403, "Sin acceso a este proyecto");

    const user = store.currentUser as AppUser;
    const roles = [user.role as AppRole];
    let items = (store.workItems as WorkItem[]).filter((w) => w.projectId === params.id);

    // Proveedor: solo ve sus workitems (los que tienen assignedToRole = Proveedor)
    if (roles.includes("Proveedor") && !roles.includes("Admin")) {
      items = items.filter((w) => w.assignedToRole === "Proveedor");
    }

    return ok(items);
  }),

  // ── GET /api/workitems ───────────────────────────────
  http.get("/api/workitems", ({ request }) => {
    const url = new URL(request.url);
    const projectId = url.searchParams.get("projectId") ?? "";
    const stateId = url.searchParams.get("stateId") ?? "";
    const assignedToRole = url.searchParams.get("assignedToRole") ?? "";

    const visibleProjectIds = new Set(visibleProjects().map((p) => p.id));
    let items = (store.workItems as WorkItem[]).filter((w) => visibleProjectIds.has(w.projectId));

    if (projectId)     items = items.filter((w) => w.projectId === projectId);
    if (stateId)       items = items.filter((w) => w.stateId === stateId);
    if (assignedToRole) items = items.filter((w) => w.assignedToRole === assignedToRole);

    return ok(items);
  }),

  // ── PATCH /api/workitems/:id/state ───────────────────
  http.patch("/api/workitems/:id/state", async ({ params, request }) => {
    const body = await request.json() as PatchWorkItemStatePayload & { assignedToUserId?: string };
    const { toStateId, evidence, assignedToUserId } = body;

    const itemIndex = store.workItems.findIndex((w) => w.id === params.id);
    if (itemIndex === -1) return err(404, "WorkItem no encontrado");

    const item = store.workItems[itemIndex] as WorkItem;

    // Verificar visibilidad del proyecto
    const visible = visibleProjects();
    if (!visible.some((p) => p.id === item.projectId)) {
      return err(403, "Sin acceso al proyecto de este WorkItem");
    }

    // Verificar transición válida
    const transition = findTransition(item.stateId, toStateId);
    if (!transition) {
      return err(400, `Transición inválida: ${item.stateId} → ${toStateId}`);
    }

    // Verificar rol
    if (!currentUserHasRole(transition.allowedRoles)) {
      return err(
        403,
        `Tu rol no puede realizar esta transición. Roles permitidos: ${transition.allowedRoles.join(", ")}`,
      );
    }

    // Verificar evidencia si es requerida (soporta requireEvidence y requireComment)
    const needsEvidence = transition.requireEvidence;
    const needsComment  = transition.requireComment && !transition.requireEvidence;
    if (needsEvidence || needsComment) {
      if (!evidence) {
        const types = needsComment ? ["comment"] : (transition.evidenceTypes ?? ["comment"]);
        return err(
          400,
          `Esta transición requiere evidencia (tipos: ${types.join(", ")})`,
        );
      }
      if (!evidence.type || (!evidence.value && !evidence.comment)) {
        return err(400, "La evidencia debe tener type y value o comment");
      }
      // Guardar evidencia en el store
      const newEvidence: Evidence = {
        id: genId("ev"),
        entityType: "WorkItem",
        entityId: item.id,
        type: evidence.type as EvidencePayload["type"],
        value: evidence.value,
        comment: evidence.comment,
        createdBy: store.currentUser.id,
        createdOn: new Date().toISOString(),
      };
      (store.evidences as Evidence[]).push(newEvidence);
    }

    // ── Validar assignedToUserId si la transición cambia de rol o requiere asignación ─────
    const assignToRoles = transition.assignToRole ?? [];
    // El rol destino es el del usuario seleccionado (si hay alguno), o assignToRoles[0], o el rol actual
    let resolvedNewRole: AppRole = (assignToRoles[0] ?? item.assignedToRole) as AppRole;

    const roleChanges = assignToRoles.length > 0 && !assignToRoles.includes(item.assignedToRole as AppRole);
    const requiresUser = transition.requireUserAssignment || roleChanges;

    if (requiresUser) {
      if (!assignedToUserId) {
        return err(
          400,
          `Esta transición requiere seleccionar un usuario asignado (rol: "${assignToRoles.join('" o "')}").`,
        );
      }
      // Verificar que el usuario existe
      const targetUser = (store.appUsers as AppUser[]).find(
        (u) => u.id === assignedToUserId,
      );
      if (!targetUser) return err(404, `Usuario "${assignedToUserId}" no encontrado`);
      // Validar que el rol del usuario está en assignToRoles
      if (assignToRoles.length > 0 && !assignToRoles.includes(targetUser.role as AppRole)) {
        return err(
          400,
          `El usuario no tiene ninguno de los roles requeridos: "${assignToRoles.join('" o ""')}"`,
        );
      }
      // El rol del WI pasa a ser el rol del usuario asignado
      resolvedNewRole = targetUser.role as AppRole;
      // Proveedor: validar que pertenece al equipo proveedor del proyecto
      if (targetUser.role === "Proveedor") {
        const project = (store.projects as Project[]).find((p) => p.id === item.projectId);
        const userInProvTeam = (targetUser.teamIds ?? []).includes(project?.providerTeamId ?? "");
        if (project && project.providerTeamId && !userInProvTeam) {
          return err(
            400,
            `El proveedor del usuario no coincide con el proveedor del proyecto`,
          );
        }
      }
    }

    const newRole = resolvedNewRole;

    // Recuperar nombre del estado anterior y nuevo para el log
    const fromState = store.states.find((s) => s.id === item.stateId);
    const toState = store.states.find((s) => s.id === toStateId);

    // Actualizar workItem
    const prevStateId = item.stateId;
    const prevUserId  = item.assignedToUserId;
    (store.workItems[itemIndex] as WorkItem).stateId = toStateId;
    (store.workItems[itemIndex] as WorkItem).assignedToRole = newRole;
    if (assignedToUserId) {
      (store.workItems[itemIndex] as WorkItem).assignedToUserId = assignedToUserId;
    }
    // Coherencia de progreso: cerrar un WI fuerza progress=100
    if (toStateId === "st-cls") {
      (store.workItems[itemIndex] as WorkItem).progress = 100;
    }
    // Simular sincronización con Jira (en mock: inmediata)
    (store.workItems[itemIndex] as WorkItem).jiraState = JIRA_STATE_MAP[toStateId] ?? toStateId;
    (store.workItems[itemIndex] as WorkItem).syncStatus = "OK";
    delete (store.workItems[itemIndex] as WorkItem & { syncError?: string }).syncError;

    const now = new Date().toISOString();

    // Registrar STATE_CHANGED en activityLog
    const stateLogEntry: ActivityLogEntry = {
      id: genId("al"),
      projectId: item.projectId,
      entityType: "WorkItem",
      entityId: item.id,
      action: "STATE_CHANGED",
      from: fromState?.name ?? prevStateId,
      to: toState?.name ?? toStateId,
      who: store.currentUser.id,
      whoRole: (store.currentUser.roles[0] as AppRole),
      at: now,
    };
    (store.activityLog as ActivityLogEntry[]).push(stateLogEntry);

    // Registrar ASSIGNMENT_CHANGED si el usuario cambió
    const finalUserId = assignedToUserId ?? item.assignedToUserId;
    if (finalUserId && finalUserId !== prevUserId) {
      const prevUserDisplay = (store.appUsers as AppUser[])
        .find((u) => u.id === prevUserId)?.displayName ?? prevUserId ?? "";
      const newUserDisplay  = (store.appUsers as AppUser[])
        .find((u) => u.id === finalUserId)?.displayName ?? finalUserId;
      const assignLog: ActivityLogEntry = {
        id: genId("al"),
        projectId: item.projectId,
        entityType: "WorkItem",
        entityId: item.id,
        action: "ASSIGNMENT_CHANGED",
        from: prevUserDisplay,
        to: newUserDisplay,
        who: store.currentUser.id,
        whoRole: (store.currentUser.roles[0] as AppRole),
        at: now,
        note: `Rol cambiado de "${item.assignedToRole}" a "${newRole}"`,
      } as ActivityLogEntry;
      (store.activityLog as ActivityLogEntry[]).push(assignLog);
    }

    return ok(store.workItems[itemIndex]);
  }),

  // ── GET /api/activity ────────────────────────────────
  http.get("/api/activity", ({ request }) => {
    const url        = new URL(request.url);
    const projectId  = url.searchParams.get("projectId")  ?? "";
    const entityType = url.searchParams.get("entityType") ?? "";
    const action     = url.searchParams.get("action")     ?? "";
    const whoRole    = url.searchParams.get("whoRole")    ?? "";
    const from       = url.searchParams.get("from")       ?? "";   // ISO date "2026-01-01"
    const to         = url.searchParams.get("to")         ?? "";   // ISO date "2026-12-31"
    const query      = (url.searchParams.get("query") ?? "").toLowerCase();

    const user  = store.currentUser as AppUser;
    const roles = [user.role as AppRole];

    let logs = store.activityLog as ActivityLogEntry[];

    // RBAC: Proveedor ve solo sus proyectos
    if (roles.includes("Proveedor") && !roles.includes("Admin")) {
      const providerTeamIds = new Set(
        (user.teamIds ?? []).filter((tid) => {
          const team = store.teams.find((t) => t.id === tid);
          return team?.type === "Provider";
        }),
      );
      const provProjectIds = new Set(
        (store.projects as Project[])
          .filter((p) => p.deliveryOwnerType === "Proveedor" &&
                         providerTeamIds.has(p.providerTeamId ?? ""))
          .map((p) => p.id),
      );
      logs = logs.filter((l) => !l.projectId || provProjectIds.has(l.projectId));
    }

    // Filtros
    if (projectId)  logs = logs.filter((l) => l.projectId === projectId);
    if (entityType) logs = logs.filter((l) => l.entityType === entityType);
    if (action)     logs = logs.filter((l) => l.action === action);
    if (whoRole)    logs = logs.filter((l) => l.whoRole === whoRole);
    if (from)       logs = logs.filter((l) => l.at >= from);
    if (to)         logs = logs.filter((l) => l.at <= to + "T23:59:59Z");

    if (query) {
      logs = logs.filter((l) => {
        const wi  = (store.workItems as WorkItem[]).find((w) => w.id === l.entityId);
        const prj = (store.projects as Project[]).find((p) => p.id === l.entityId || p.id === l.projectId);
        const who = store.appUsers.find((u) => u.id === l.who)?.displayName?.toLowerCase() ?? l.who.toLowerCase();
        return (
          l.action.toLowerCase().includes(query) ||
          l.from.toLowerCase().includes(query) ||
          l.to.toLowerCase().includes(query) ||
          (l.note ?? "").toLowerCase().includes(query) ||
          who.includes(query) ||
          wi?.title.toLowerCase().includes(query) ||
          wi?.jiraIssueKey?.toLowerCase().includes(query) ||
          prj?.name.toLowerCase().includes(query) ||
          prj?.code.toLowerCase().includes(query)
        );
      });
    }

    return ok([...logs].sort((a, b) => (a.at < b.at ? 1 : -1)));
  }),

  // ── GET /api/evidences ───────────────────────────────
  http.get("/api/evidences", ({ request }) => {
    const url       = new URL(request.url);
    const entityType = url.searchParams.get("entityType") ?? "";
    const entityId   = url.searchParams.get("entityId")   ?? "";
    const projectId  = url.searchParams.get("projectId")  ?? "";
    const type       = url.searchParams.get("type")       ?? "";
    const createdBy  = url.searchParams.get("createdBy")  ?? "";
    const query      = url.searchParams.get("query")      ?? "";

    // Proyectos visibles para este usuario (RBAC)
    const visProjectIds = new Set(visibleProjects().map((p) => p.id));

    let evs = (store.evidences as Evidence[]).filter((e) => {
      // Si la evidencia es de WorkItem, filtrar por proyecto visible
      if (e.entityType === "WorkItem") {
        const wi = (store.workItems as WorkItem[]).find((w) => w.id === e.entityId);
        if (!wi || !visProjectIds.has(wi.projectId)) return false;
        if (projectId && wi.projectId !== projectId) return false;
      }
      if (e.entityType === "Project") {
        if (!visProjectIds.has(e.entityId)) return false;
        if (projectId && e.entityId !== projectId) return false;
      }
      if (entityType && e.entityType !== entityType) return false;
      if (entityId   && e.entityId   !== entityId)   return false;
      if (type       && e.type       !== type)        return false;
      if (createdBy  && e.createdBy  !== createdBy)   return false;
      if (query) {
        const q = query.toLowerCase();
        const wi = e.entityType === "WorkItem"
          ? (store.workItems as WorkItem[]).find((w) => w.id === e.entityId)
          : undefined;
        const hit =
          e.comment.toLowerCase().includes(q) ||
          e.value.toLowerCase().includes(q) ||
          (wi?.title?.toLowerCase().includes(q) ?? false) ||
          (wi?.jiraIssueKey?.toLowerCase().includes(q) ?? false);
        if (!hit) return false;
      }
      return true;
    });

    // Ordenar descendente por fecha
    evs = [...evs].sort((a, b) => (a.createdOn < b.createdOn ? 1 : -1));

    return ok(evs);
  }),

  // ── POST /api/evidences ──────────────────────────────
  http.post("/api/evidences", async ({ request }) => {
    const body = await request.json() as {
      entityType: "WorkItem" | "Project";
      entityId: string;
      type: "link" | "comment" | "file";
      value: string;
      comment: string;
    };

    if (!body.entityId || !body.type) {
      return err(400, "entityId y type son obligatorios");
    }
    if (body.type === "link" && !body.value) {
      return err(400, "El tipo 'link' requiere un valor URL");
    }

    // RBAC: Proveedor solo puede añadir evidencia en sus proyectos
    const user    = store.currentUser as AppUser;
    const roles   = [user.role as AppRole];
    if (roles.includes("Invitado")) {
      return err(403, "Invitado no puede añadir evidencias");
    }
    if (roles.includes("Proveedor")) {
      const providerTeamIds = new Set(
        (user.teamIds ?? []).filter((tid) => {
          const team = store.teams.find((t) => t.id === tid);
          return team?.type === "Provider";
        }),
      );
      if (body.entityType === "WorkItem") {
        const wi = (store.workItems as WorkItem[]).find((w) => w.id === body.entityId);
        const proj = wi ? (store.projects as Project[]).find((p) => p.id === wi.projectId) : undefined;
        if (!proj || !providerTeamIds.has(proj.providerTeamId ?? "")) {
          return err(403, "No tienes acceso a este proyecto");
        }
      }
    }

    // Determinar projectId para el activityLog
    let projectId = "";
    if (body.entityType === "WorkItem") {
      const wi = (store.workItems as WorkItem[]).find((w) => w.id === body.entityId);
      projectId = wi?.projectId ?? "";
    } else if (body.entityType === "Project") {
      projectId = body.entityId;
    }

    const newEvidence: Evidence = {
      id:         genId("ev"),
      entityType: body.entityType,
      entityId:   body.entityId,
      type:       body.type,
      value:      body.value  ?? "",
      comment:    body.comment ?? "",
      createdBy:  store.currentUser.id,
      createdOn:  new Date().toISOString(),
    };
    (store.evidences as Evidence[]).push(newEvidence);

    // Registrar en activityLog
    const logEntry: ActivityLogEntry = {
      id:         genId("al"),
      projectId,
      entityType: "Evidence",
      entityId:   newEvidence.id,
      action:     "EVIDENCE_ADDED",
      from:       "",
      to:         "",
      who:        store.currentUser.id,
      whoRole:    (store.currentUser as AppUser).role as AppRole,
      at:         new Date().toISOString(),
      note:       body.comment,
    };
    (store.activityLog as ActivityLogEntry[]).push(logEntry);

    return HttpResponse.json(newEvidence, { status: 201 });
  }),

  // ── GET /api/risks ───────────────────────────────────
  http.get("/api/risks", ({ request }) => {
    const url        = new URL(request.url);
    const projectId  = url.searchParams.get("projectId")  ?? "";
    const severity   = url.searchParams.get("severity")   ?? "";
    const status     = url.searchParams.get("status")     ?? "";
    const ownerRole  = url.searchParams.get("ownerRole")  ?? "";
    const onlyDueSoon= url.searchParams.get("onlyDueSoon") === "true";
    const query      = (url.searchParams.get("query") ?? "").toLowerCase().trim();

    const visibleProjectIds = new Set(visibleProjects().map((p) => p.id));
    let risks = (store.risks as Array<typeof store.risks[0]>).filter(
      (r) => visibleProjectIds.has(r.projectId) || r.projectId === "",
    );

    if (projectId)  risks = risks.filter((r) => r.projectId === projectId);
    if (severity)   risks = risks.filter((r) => r.severity === severity);
    if (status)     risks = risks.filter((r) => r.status === status);
    if (ownerRole)  risks = risks.filter((r) => r.ownerRole === ownerRole);
    if (onlyDueSoon) {
      const cutoff = new Date(Date.now() + 14 * 86_400_000);
      risks = risks.filter((r) => r.dueDate && new Date(r.dueDate) <= cutoff);
    }
    if (query) {
      risks = risks.filter((r) =>
        r.title.toLowerCase().includes(query) ||
        ((r as { description?: string }).description ?? "").toLowerCase().includes(query),
      );
    }

    // Ordenar: Alta > Media > Baja, luego por dueDate
    const sevOrd: Record<string, number> = { Alta: 0, Media: 1, Baja: 2 };
    risks = [...risks].sort((a, b) => {
      const s = (sevOrd[a.severity] ?? 1) - (sevOrd[b.severity] ?? 1);
      if (s !== 0) return s;
      return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
    });

    return ok(risks);
  }),

  // ── POST /api/risks ────────────────────────────────────
  http.post("/api/risks", async ({ request }) => {
    const roles = store.currentUser.roles as AppRole[];
    const canCreate = roles.includes("Admin") || roles.includes("IT AirEuropa") || roles.includes("Proveedor");
    if (!canCreate) return err(403, "Sin permisos para crear riesgos");

    const body = await request.json() as {
      projectId: string; title: string; description?: string;
      severity: string; ownerRole: string; dueDate: string;
      linkedWorkItemId?: string;
    };
    if (!body.projectId || !body.title || !body.severity || !body.dueDate)
      return err(400, "Campos obligatorios: projectId, title, severity, dueDate");

    const visibleIds = new Set(visibleProjects().map((p) => p.id));
    if (!visibleIds.has(body.projectId)) return err(403, "Sin acceso al proyecto");

    const newRisk = {
      id:               genId("rk"),
      projectId:        body.projectId,
      title:            body.title,
      description:      body.description ?? "",
      severity:         body.severity,
      status:           "Abierto",
      ownerRole:        body.ownerRole ?? "IT AirEuropa",
      dueDate:          body.dueDate,
      linkedWorkItemId: body.linkedWorkItemId ?? "",
      createdBy:        store.currentUser.id,
      createdOn:        new Date().toISOString(),
    };
    (store.risks as typeof store.risks).push(newRisk as typeof store.risks[0]);

    // Registro en activityLog
    const logEntry: ActivityLogEntry = {
      id:         genId("al"),
      projectId:  body.projectId,
      entityType: "Risk",
      entityId:   newRisk.id,
      action:     "RISK_CREATED",
      from:       "",
      to:         body.title,
      who:        store.currentUser.id,
      whoRole:    (store.currentUser.roles[0] as AppRole),
      at:         new Date().toISOString(),
    };
    (store.activityLog as ActivityLogEntry[]).push(logEntry);

    return ok(newRisk);
  }),

  // ── PATCH /api/risks/:id ───────────────────────────────
  http.patch("/api/risks/:id", async ({ params, request }) => {
    const roles = store.currentUser.roles as AppRole[];
    const canEdit = roles.includes("Admin") || roles.includes("IT AirEuropa");
    if (!canEdit) return err(403, "Sin permisos para editar riesgos");

    const idx = store.risks.findIndex((r) => r.id === params.id);
    if (idx === -1) return err(404, "Riesgo no encontrado");

    const body = await request.json() as Record<string, unknown>;
    const updated = { ...store.risks[idx], ...body };
    (store.risks as typeof store.risks)[idx] = updated as typeof store.risks[0];

    return ok(updated);
  }),

  // ── POST /api/risks/:id/close ──────────────────────────
  http.post("/api/risks/:id/close", async ({ params, request }) => {
    const roles = store.currentUser.roles as AppRole[];
    const canClose = roles.includes("Admin") || roles.includes("IT AirEuropa");
    if (!canClose) return err(403, "Sin permisos para cerrar riesgos");

    const idx = store.risks.findIndex((r) => r.id === params.id);
    if (idx === -1) return err(404, "Riesgo no encontrado");

    const body = await request.json() as { closeComment?: string };
    const now  = new Date().toISOString();
    const updated = {
      ...store.risks[idx],
      status:       "Resuelto",
      closedBy:     store.currentUser.id,
      closedOn:     now,
      closeComment: body.closeComment ?? "",
    };
    (store.risks as typeof store.risks)[idx] = updated as typeof store.risks[0];

    // Registro en activityLog
    const logEntry: ActivityLogEntry = {
      id:         genId("al"),
      projectId:  updated.projectId,
      entityType: "Risk",
      entityId:   updated.id,
      action:     "RISK_CLOSED",
      from:       "Abierto",
      to:         "Resuelto",
      who:        store.currentUser.id,
      whoRole:    (store.currentUser.roles[0] as AppRole),
      at:         now,
      note:       body.closeComment ?? "",
    };
    (store.activityLog as ActivityLogEntry[]).push(logEntry);

    return ok(updated);
  }),

  // ── GET /api/reports/kpis ────────────────────────────
  http.get("/api/reports/kpis", ({ request }) => {
    const url         = new URL(request.url);
    const projectId   = url.searchParams.get("projectId")         ?? "";
    const areaId      = url.searchParams.get("areaId")            ?? "";
    const providerId  = url.searchParams.get("providerId")        ?? "";
    const dotStr      = url.searchParams.get("deliveryOwnerType") ?? "";
    const periodDays  = parseInt(url.searchParams.get("periodDays") ?? "30", 10);
    const onlyBlocked = url.searchParams.get("onlyBlocked") === "true";
    const onlyDueSoon = url.searchParams.get("onlyDueSoon") === "true";

    // ── 1. Filtrar proyectos visibles ──────────────────
    let projects = visibleProjects();
    if (projectId) projects = projects.filter((p) => p.id === projectId);
    if (areaId)    projects = projects.filter((p) => p.businessAreaId === areaId);
    if (providerId) projects = projects.filter((p) => p.providerId === providerId);
    if (dotStr)    projects = projects.filter((p) => p.deliveryOwnerType === dotStr);

    const projectIds = new Set(projects.map((p) => p.id));
    let workItems    = (store.workItems as WorkItem[]).filter((w) => projectIds.has(w.projectId));

    if (onlyBlocked)  workItems = workItems.filter((w) => w.stateId === "st-blk" || !!(w as { blockedReason?: string }).blockedReason);
    const today       = new Date();
    const dueSoonDate = new Date(today.getTime() + 14 * 86_400_000);
    if (onlyDueSoon)  workItems = workItems.filter((w) => w.endDate && new Date(w.endDate) <= dueSoonDate);

    // ── 2. Tareas cerradas en el periodo ───────────────
    const periodStart = new Date(today.getTime() - periodDays * 86_400_000);
    const closedLogs  = (store.activityLog as ActivityLogEntry[]).filter(
      (l) =>
        l.action === "STATE_CHANGED" &&
        l.to     === "Cerrado"        &&
        new Date(l.at) >= periodStart &&
        projectIds.has(l.projectId),
    );
    const closedIdsInPeriod = new Set(closedLogs.map((l) => l.entityId));

    // ── 3. KPIs globales ──────────────────────────────
    const blocked    = workItems.filter((w) => w.stateId === "st-blk" || !!(w as { blockedReason?: string }).blockedReason).length;
    const dueSoon    = workItems.filter((w) => w.endDate && new Date(w.endDate) <= dueSoonDate && w.stateId !== "st-cls").length;
    const syncErrors = workItems.filter((w) => w.syncStatus === "Error").length;

    const kpis = {
      totalProjects:  projects.length,
      totalTasks:     workItems.length,
      closedInPeriod: closedIdsInPeriod.size,
      blocked,
      dueSoon,
      syncErrors,
    };

    // ── 4. Por proveedor ─────────────────────────────
    const providerMap = new Map(store.providers.map((p) => [p.id, p.name]));
    const providerRowMap = new Map<string, { name: string; projects: Set<string>; tasks: WorkItem[]; }>();

    for (const p of projects) {
      const key  = p.providerId || "__it__";
      const name = p.providerId ? (providerMap.get(p.providerId) ?? p.providerId) : "IT AirEuropa (interno)";
      if (!providerRowMap.has(key)) providerRowMap.set(key, { name, projects: new Set(), tasks: [] });
      providerRowMap.get(key)!.projects.add(p.id);
    }
    for (const wi of workItems) {
      const prj = projects.find((p) => p.id === wi.projectId);
      if (!prj) continue;
      const key = prj.providerId || "__it__";
      providerRowMap.get(key)?.tasks.push(wi);
    }
    const byProvider = Array.from(providerRowMap.entries()).map(([pid, row]) => {
      const tasks          = row.tasks;
      const closedPeriod   = tasks.filter((w) => closedIdsInPeriod.has(w.id)).length;
      const blockedTasks   = tasks.filter((w) => w.stateId === "st-blk" || !!(w as { blockedReason?: string }).blockedReason).length;
      const totalClosed    = tasks.filter((w) => w.stateId === "st-cls").length;
      const pct = tasks.length > 0 ? Math.round((totalClosed / tasks.length) * 100) : 0;
      return {
        providerId:     pid,
        providerName:   row.name,
        projects:       row.projects.size,
        tasks:          tasks.length,
        blocked:        blockedTasks,
        closedInPeriod: closedPeriod,
        pctClosed:      pct,
      };
    }).sort((a, b) => b.tasks - a.tasks);

    // ── 5. Por área ──────────────────────────────────
    const areaMap    = new Map(store.businessAreas.map((a) => [a.id, a.name]));
    const areaRowMap = new Map<string, { name: string; projects: Set<string>; tasks: WorkItem[]; }>();

    for (const p of projects) {
      const key  = p.businessAreaId;
      const name = areaMap.get(key) ?? key;
      if (!areaRowMap.has(key)) areaRowMap.set(key, { name, projects: new Set(), tasks: [] });
      areaRowMap.get(key)!.projects.add(p.id);
    }
    for (const wi of workItems) {
      const prj = projects.find((p) => p.id === wi.projectId);
      if (!prj) continue;
      areaRowMap.get(prj.businessAreaId)?.tasks.push(wi);
    }
    const byArea = Array.from(areaRowMap.entries()).map(([aid, row]) => {
      const tasks        = row.tasks;
      const closedPeriod = tasks.filter((w) => closedIdsInPeriod.has(w.id)).length;
      const blockedTasks = tasks.filter((w) => w.stateId === "st-blk" || !!(w as { blockedReason?: string }).blockedReason).length;
      const totalClosed  = tasks.filter((w) => w.stateId === "st-cls").length;
      const pct = tasks.length > 0 ? Math.round((totalClosed / tasks.length) * 100) : 0;
      return {
        areaId:         aid,
        areaName:       row.name,
        projects:       row.projects.size,
        tasks:          tasks.length,
        blocked:        blockedTasks,
        closedInPeriod: closedPeriod,
        pctClosed:      pct,
      };
    }).sort((a, b) => b.tasks - a.tasks);

    // ── 6. Tendencia semanal ─────────────────────────
    const numWeeks   = Math.ceil(Math.min(periodDays, 90) / 7);
    const weeklyTrend = Array.from({ length: numWeeks }, (_, i) => {
      const weekEnd   = new Date(today.getTime() - i * 7 * 86_400_000);
      const weekStart = new Date(weekEnd.getTime() - 7 * 86_400_000);
      const closed    = (store.activityLog as ActivityLogEntry[]).filter(
        (l) => l.action === "STATE_CHANGED" && l.to === "Cerrado" &&
               new Date(l.at) >= weekStart && new Date(l.at) < weekEnd &&
               projectIds.has(l.projectId),
      ).length;
      const label = weekEnd.toLocaleDateString("es-ES", { day: "2-digit", month: "short" });
      return { label, closed };
    }).reverse();

    // ── 7. Top riesgos ───────────────────────────────
    const projectCodeMap = new Map(projects.map((p) => [p.id, p.code]));
    const topRisks = store.risks
      .filter((r) => projectIds.has(r.projectId))
      .filter((r) => r.status !== "Resuelto")
      .map((r) => {
        const daysLeft = Math.ceil((new Date(r.dueDate).getTime() - today.getTime()) / 86_400_000);
        return {
          id:          r.id,
          projectId:   r.projectId,
          projectCode: projectCodeMap.get(r.projectId) ?? r.projectId,
          title:       r.title,
          severity:    r.severity,
          status:      r.status,
          dueDate:     r.dueDate,
          daysLeft,
        };
      })
      .sort((a, b) => {
        const sevOrd: Record<string, number> = { Alta: 0, Media: 1, Baja: 2 };
        const s = (sevOrd[a.severity] ?? 1) - (sevOrd[b.severity] ?? 1);
        return s !== 0 ? s : a.daysLeft - b.daysLeft;
      })
      .slice(0, 10);

    return ok({ kpis, byProvider, byArea, weeklyTrend, topRisks });
  }),

  // ── POST /api/workitems/:id/jira-comment ──────────────
  // Simula el envío de un comentario a Jira vía Power Automate
  http.post("/api/workitems/:id/jira-comment", async ({ params, request }) => {
    const body = await request.json() as { comment: string; evidence?: EvidencePayload };

    const item = (store.workItems as WorkItem[]).find((w) => w.id === params.id);
    if (!item) return err(404, "WorkItem no encontrado");

    const visible = visibleProjects();
    if (!visible.some((p) => p.id === item.projectId))
      return err(403, "Sin acceso al proyecto");

    if (!body.comment?.trim())
      return err(400, "El comentario no puede estar vacío");

    // Registrar ActionRequest en el store
    const actionReq: ActionRequest = {
      id: genId("ar"),
      workItemId: item.id,
      actionType: "Comment",
      payload: { comment: body.comment, evidence: body.evidence },
      status: "Done",
      createdAt: new Date().toISOString(),
    };
    (store.actionRequests as ActionRequest[]).push(actionReq);

    // Registrar en activityLog
    const logEntry: ActivityLogEntry = {
      id: genId("al"),
      projectId: item.projectId,
      entityType: "WorkItem",
      entityId: item.id,
      action: "JIRA_COMMENT_SENT",
      from: "",
      to: body.comment,
      who: store.currentUser.id,
      whoRole: (store.currentUser.roles[0] as AppRole),
      at: new Date().toISOString(),
    };
    (store.activityLog as ActivityLogEntry[]).push(logEntry);

    return ok({ success: true, message: "Comentario enviado a Jira correctamente via Power Automate." });
  }),

  // ── POST /api/workitems/:id/retry-sync ─────────────
  // Reintenta la sincronización con Jira (mock: siempre OK)
  http.post("/api/workitems/:id/retry-sync", ({ params }) => {
    const idx = store.workItems.findIndex((w) => w.id === params.id);
    if (idx === -1) return err(404, "WorkItem no encontrado");

    const roles = store.currentUser.roles as AppRole[];
    if (!roles.includes("Admin") && !roles.includes("IT AirEuropa"))
      return err(403, "Solo Admin/IT puede reintentar el sync");

    (store.workItems[idx] as WorkItem).syncStatus = "OK";
    delete (store.workItems[idx] as WorkItem & { syncError?: string }).syncError;

    return ok(store.workItems[idx]);
  }),

  // ── PATCH /api/workitems/:id/dates ───────────────────
  http.patch("/api/workitems/:id/dates", async ({ params, request }) => {
    const body = await request.json() as { startDate: string; endDate: string };

    const idx = store.workItems.findIndex((w) => w.id === params.id);
    if (idx === -1) return err(404, "WorkItem no encontrado");

    const item = store.workItems[idx] as WorkItem;

    const visible = visibleProjects();
    if (!visible.some((p) => p.id === item.projectId))
      return err(403, "Sin acceso al proyecto");

    const roles = store.currentUser.roles as AppRole[];
    const isAdminOrIT = roles.includes("Admin") || roles.includes("IT AirEuropa");
    if (!isAdminOrIT) {
      if (roles.includes("Proveedor")) {
        if (item.assignedToRole !== "Proveedor")
          return err(403, "Solo puedes editar ítems asignados al Proveedor");
      } else {
        return err(403, "Sin permisos para editar fechas");
      }
    }

    if (!body.startDate || !body.endDate)
      return err(400, "startDate y endDate son requeridos");

    if (body.startDate > body.endDate)
      return err(400, "La fecha de inicio no puede ser posterior a la de fin");

    (store.workItems[idx] as WorkItem).startDate = body.startDate;
    (store.workItems[idx] as WorkItem).endDate   = body.endDate;

    return ok(store.workItems[idx]);
  }),

  // ── PATCH /api/workitems/:id ─────────────────────────
  // Edición general de un WorkItem (título, prioridad, asignación, etc.)
  // RBAC: Admin + IT pueden todo; Proveedor solo sus ítems.
  http.patch("/api/workitems/:id", async ({ params, request }) => {
    const body = await request.json() as {
      title?: string; description?: string; type?: string; priority?: string;
      assignedToRole?: string; assignedToUserId?: string;
      startDate?: string; endDate?: string; tags?: string[]; blockedReason?: string;
    };

    const idx = store.workItems.findIndex((w) => w.id === params.id);
    if (idx === -1) return err(404, "WorkItem no encontrado");

    const item = store.workItems[idx] as WorkItem;
    const visible = visibleProjects();
    if (!visible.some((p) => p.id === item.projectId))
      return err(403, "Sin acceso al proyecto");

    const roles = store.currentUser.roles as AppRole[];
    const isAdminOrIT = roles.includes("Admin") || roles.includes("IT AirEuropa");
    if (!isAdminOrIT) {
      if (roles.includes("Proveedor")) {
        if (item.assignedToRole !== "Proveedor")
          return err(403, "Solo puedes editar ítems asignados al Proveedor");
      } else {
        return err(403, "Sin permisos para editar tareas");
      }
    }

    // Validar cambio de asignación si viene en el body
    if (body.assignedToUserId) {
      const targetUser = (store.users as typeof store.users).find(
        (u) => u.id === body.assignedToUserId,
      );
      if (!targetUser) return err(404, `Usuario "${body.assignedToUserId}" no encontrado`);
      const reqRole = (body.assignedToRole as AppRole) ?? item.assignedToRole;
      if (!targetUser.roles.includes(reqRole)) {
        return err(400, `El usuario no tiene el rol requerido "${reqRole}"`);
      }
      if (reqRole === "Proveedor") {
        const project = (store.projects as Project[]).find((p) => p.id === item.projectId);
        const userProv = (targetUser as { providerId?: string }).providerId ?? "";
        if (project && project.providerId && userProv !== project.providerId) {
          return err(400, "El proveedor del usuario no coincide con el del proyecto");
        }
      }
    }

    const prevUserId = item.assignedToUserId;
    const now = new Date().toISOString();

    // Aplicar cambios
    const wi = store.workItems[idx] as WorkItem;
    if (body.title       !== undefined) wi.title            = body.title.trim();
    if (body.description !== undefined) wi.description      = body.description;
    if (body.type        !== undefined) wi.type             = body.type as WorkItem["type"];
    if (body.priority    !== undefined) wi.priority         = body.priority as WorkItem["priority"];
    if (body.startDate   !== undefined) wi.startDate        = body.startDate;
    if (body.endDate     !== undefined) wi.endDate          = body.endDate;
    if (body.tags        !== undefined) wi.tags             = body.tags;
    if (body.blockedReason !== undefined) wi.blockedReason  = body.blockedReason;
    if (body.assignedToRole !== undefined) wi.assignedToRole = body.assignedToRole as AppRole;
    if (body.assignedToUserId !== undefined) wi.assignedToUserId = body.assignedToUserId;

    // Log ASSIGNMENT_CHANGED si el usuario cambió
    if (body.assignedToUserId && body.assignedToUserId !== prevUserId) {
      const prevUserDisplay = (store.users as typeof store.users)
        .find((u) => u.id === prevUserId)?.displayName ?? prevUserId ?? "";
      const newUserDisplay  = (store.users as typeof store.users)
        .find((u) => u.id === body.assignedToUserId)?.displayName ?? body.assignedToUserId ?? "";
      const assignLog: ActivityLogEntry = {
        id: genId("al"),
        projectId: item.projectId,
        entityType: "WorkItem",
        entityId: item.id,
        action: "ASSIGNMENT_CHANGED",
        from: prevUserDisplay,
        to: newUserDisplay,
        who: store.currentUser.id,
        whoRole: (store.currentUser.roles[0] as AppRole),
        at: now,
        note: body.assignedToRole
          ? `Rol: "${body.assignedToRole}"`
          : undefined,
      } as ActivityLogEntry;
      (store.activityLog as ActivityLogEntry[]).push(assignLog);
    }

    return ok(store.workItems[idx]);
  }),

  // ── POST /api/workitems ──────────────────────────────
  // Crea un WorkItem nuevo asociado a un projectId.
  // RBAC: Admin, IT AirEuropa y Proveedor pueden crear;
  //       Invitado y Usuario de solo-lectura no pueden.
  http.post("/api/workitems", async ({ request }) => {
    const roles = store.currentUser.roles as AppRole[];
    const canCreate =
      roles.includes("Admin") ||
      roles.includes("IT AirEuropa") ||
      roles.includes("Proveedor");
    if (!canCreate) return err(403, "Sin permisos para crear tareas");

    const body = await request.json() as Partial<WorkItem> & {
      projectId: string; title: string; assignedToUserId?: string;
    };

    if (!body.projectId) return err(400, "projectId es obligatorio");
    if (!body.title?.trim()) return err(400, "El título es obligatorio");
    if (!body.startDate || !body.endDate) return err(400, "startDate y endDate son obligatorios");
    if (body.startDate > body.endDate) return err(400, "startDate no puede ser posterior a endDate");
    if (!body.assignedToUserId) return err(400, "assignedToUserId es obligatorio");

    const project = (store.projects as Project[]).find((p) => p.id === body.projectId);
    if (!project) return err(404, "Proyecto no encontrado");

    // Visibilidad
    const visible = visibleProjects();
    if (!visible.some((p) => p.id === project.id)) return err(403, "Sin acceso al proyecto");

    // Validar usuario asignado contra appUsers (tienen teamIds)
    const targetUser = (store.appUsers as AppUser[]).find(
      (u) => u.id === body.assignedToUserId,
    );
    if (!targetUser) return err(404, `Usuario "${body.assignedToUserId}" no encontrado`);

    const reqRole = (body.assignedToRole as AppRole) ?? "IT AirEuropa";
    if (targetUser.role !== reqRole) {
      return err(400, `El usuario no tiene el rol requerido "${reqRole}"`);
    }

    // Validar pertenencia al equipo si se informa assignedToTeamId
    const reqTeamId = (body as Partial<WorkItem>).assignedToTeamId ?? "";
    if (reqTeamId && !targetUser.teamIds.includes(reqTeamId)) {
      return err(400, `El usuario no pertenece al equipo "${reqTeamId}"`);
    }

    // Proveedor: equipo obligatorio
    if (reqRole === "Proveedor" && !reqTeamId) {
      return err(400, `El equipo es obligatorio cuando el rol es Proveedor`);
    }

    // Advertencia (no bloquea) si el proyecto está Cerrado — lo reflejamos en log
    const projectClosed = project.status === "Cerrado";

    const newItem: WorkItem = {
      id:               genId("wi"),
      projectId:        body.projectId,
      title:            body.title.trim(),
      type:             (body.type as WorkItem["type"]) ?? "Feature",
      priority:         (body.priority as WorkItem["priority"]) ?? "Media",
      stateId:          body.stateId ?? "st-new",
      assignedToRole:   reqRole,
      assignedToTeamId: reqTeamId || null,
      assignedToUserId: body.assignedToUserId,
      startDate:        body.startDate,
      endDate:          body.endDate,
      progress:         0,
      tags:             body.tags ?? [],
      createdBy:        store.currentUser.id,
      description:      body.description ?? "",
      // \u2500\u2500 Integraci\u00f3n Jira (estructura lista para Power Automate) \u2500\u2500
      jiraIssueKey:   body.jiraIssueKey ?? "",
      jiraUrl:        body.jiraUrl ?? "",
      jiraState:      "Backlog",
      syncStatus:     "Pending",
    } as WorkItem;

    (store.workItems as WorkItem[]).push(newItem);

    // Registrar en activityLog
    const logEntry: ActivityLogEntry = {
      id:         genId("al"),
      projectId:  body.projectId,
      entityType: "WorkItem",
      entityId:   newItem.id,
      action:     "WORKITEM_CREATED",
      from:       "",
      to:         newItem.title,
      who:        store.currentUser.id,
      whoRole:    (store.currentUser.roles[0] as AppRole),
      at:         new Date().toISOString(),
      note:       projectClosed ? "Creada sobre proyecto cerrado" : undefined,
    } as ActivityLogEntry;
    (store.activityLog as ActivityLogEntry[]).push(logEntry);

    return HttpResponse.json(newItem, { status: 201 });
  }),

  // ── POST /api/projects ────────────────────────────────
  http.post("/api/projects", async ({ request }) => {
    const roles = store.currentUser.roles as AppRole[];
    const canCreate = roles.includes("Admin") || roles.includes("IT AirEuropa");
    if (!canCreate) return err(403, "Sin permisos para crear proyectos");

    const body = await request.json() as Partial<Project> & { code: string; name: string };

    if (!body.code?.trim()) return err(400, "El código es obligatorio");
    if (!body.name?.trim()) return err(400, "El nombre es obligatorio");
    if (!body.startDate || !body.endDate) return err(400, "Las fechas son obligatorias");
    if (body.startDate > body.endDate) return err(400, "startDate no puede ser posterior a endDate");

    // Código único
    const duplicate = (store.projects as Project[]).some(
      (p) => p.code.toLowerCase() === body.code!.trim().toLowerCase(),
    );
    if (duplicate) return err(409, `Ya existe un proyecto con el código "${body.code}"`);

    const newProject: Project = {
      id:                genId("proj"),
      code:              body.code.trim().toUpperCase(),
      name:              body.name.trim(),
      businessAreaId:    body.businessAreaId ?? "",
      deliveryOwnerType: (body.deliveryOwnerType as Project["deliveryOwnerType"]) ?? "IT",
      providerId:        body.providerId ?? "",
      providerTeamId:    body.providerTeamId ?? null,
      status:            (body.status as Project["status"]) ?? "Pendiente",
      category:          body.category ?? "",
      priority:          (body.priority as Project["priority"]) ?? "Media",
      startDate:         body.startDate,
      endDate:           body.endDate,
      progress:          0,
      requestedByUserId: store.currentUser.id,
      // Visibilidad
      visibilityMode:    body.visibilityMode ?? "Enterprise",
      visibilityTeamIds: body.visibilityTeamIds ?? [],
      // Asignación de responsable
      ...(body.assignedToRole    ? { assignedToRole:   body.assignedToRole   as AppRole } : {}),
      ...(body.assignedToTeamId  ? { assignedToTeamId: body.assignedToTeamId as string  } : {}),
      ...(body.assignedToUserId  ? { assignedToUserId: body.assignedToUserId as string  } : {}),
    };

    (store.projects as Project[]).push(newProject);

    const logEntry: ActivityLogEntry = {
      id:         genId("al"),
      projectId:  newProject.id,
      entityType: "Project",
      entityId:   newProject.id,
      action:     "PROJECT_CREATED",
      from:       "",
      to:         newProject.name,
      who:        store.currentUser.id,
      whoRole:    (store.currentUser.roles[0] as AppRole),
      at:         new Date().toISOString(),
    } as ActivityLogEntry;
    (store.activityLog as ActivityLogEntry[]).push(logEntry);

    return HttpResponse.json(newProject, { status: 201 });
  }),

  // ── PATCH /api/projects/:id ───────────────────────────
  http.patch("/api/projects/:id", async ({ params, request }) => {
    if (!currentUserHasRole(["Admin", "IT AirEuropa"])) {
      return err(403, "Sin permisos para editar proyectos");
    }
    const idx = (store.projects as Project[]).findIndex((p) => p.id === params.id);
    if (idx === -1) return err(404, "Proyecto no encontrado");

    const body = await request.json() as Partial<Project>;

    // Validar fechas si se envían
    const startDate = body.startDate ?? (store.projects as Project[])[idx].startDate;
    const endDate   = body.endDate   ?? (store.projects as Project[])[idx].endDate;
    if (startDate > endDate) return err(400, "startDate no puede ser posterior a endDate");

    // Validar visibilityMode si se envía
    if (body.visibilityMode && !["Enterprise", "Restricted"].includes(body.visibilityMode)) {
      return err(400, "visibilityMode debe ser 'Enterprise' o 'Restricted'");
    }

    const before = { ...(store.projects as Project[])[idx] };
    Object.assign((store.projects as Project[])[idx], body);
    const updated = (store.projects as Project[])[idx];

    const cu = store.currentUser as AppUser;
    (store.auditLog as unknown[]).push({
      id: genId("audit"), category: "Project", action: "PROJECT_UPDATED",
      who: cu.id, whoRole: cu.role ?? (cu as unknown as { roles: string[] }).roles?.[0],
      at: new Date().toISOString(), entityType: "Project", entityId: updated.id,
      before, after: updated,
      description: `Proyecto '${updated.name}' actualizado`,
    });

    return ok({ ...updated, progress: computeProjectProgress(updated.id) });
  }),

  // ── GET /api/me ──────────────────────────────────────
  http.get("/api/me", () => ok(store.currentUser)),

  // ─────────────────────────────────────────────────────
  //  ADMINISTRACIÓN
  // ─────────────────────────────────────────────────────

  // RBAC defaults (usado por restore)
  // Se define aquí para estar próximo a los handlers que lo usan.

  // ── GET /api/admin/settings ───────────────────────────
  http.get("/api/admin/settings", () => {
    if (!currentUserHasRole(["Admin"])) return err(403, "Solo el Administrador puede acceder");
    return ok({ settings: store.settings, wipLimits: store.wipLimits });
  }),

  // ── PATCH /api/admin/settings ─────────────────────────
  http.patch("/api/admin/settings", async ({ request }) => {
    if (!currentUserHasRole(["Admin"])) return err(403, "Solo el Administrador puede acceder");
    const body = await request.json() as Record<string, unknown>;
    const before = { ...store.settings };
    Object.assign(store.settings, body);
    (store.auditLog as unknown[]).push({
      id: genId("audit"),
      category: "Settings",
      action: "SETTINGS_CHANGED",
      who: store.currentUser.id,
      whoRole: store.currentUser.roles[0],
      at: new Date().toISOString(),
      before,
      after: { ...store.settings },
      description: `Configuración actualizada: ${Object.keys(body).join(", ")}`,
    });
    return ok(store.settings);
  }),

  // ── PATCH /api/admin/wip-limits ───────────────────────
  http.patch("/api/admin/wip-limits", async ({ request }) => {
    if (!currentUserHasRole(["Admin"])) return err(403, "Solo el Administrador puede acceder");
    const body = await request.json() as Record<string, number>;
    const before = { ...(store.wipLimits as Record<string, number>) };
    Object.assign(store.wipLimits as Record<string, number>, body);
    (store.auditLog as unknown[]).push({
      id: genId("audit"),
      category: "Settings",
      action: "WIP_LIMIT_CHANGED",
      who: store.currentUser.id,
      whoRole: store.currentUser.roles[0],
      at: new Date().toISOString(),
      before,
      after: { ...(store.wipLimits as Record<string, number>) },
      description: `Límites WIP actualizados: ${JSON.stringify(body)}`,
    });
    return ok(store.wipLimits);
  }),

  // ── GET /api/admin/role-permissions ───────────────────
  http.get("/api/admin/role-permissions", () => {
    if (!currentUserHasRole(["Admin"])) return err(403, "Solo el Administrador puede acceder");
    return ok({
      permissions: store.rbacPermissions,
      rolePermissions: store.rolePermissions,
    });
  }),

  // ── PATCH /api/admin/role-permissions ─────────────────
  http.patch("/api/admin/role-permissions", async ({ request }) => {
    if (!currentUserHasRole(["Admin"])) return err(403, "Solo el Administrador puede acceder");
    const { role, key, value } = await request.json() as { role: string; key: string; value: boolean };

    // Inmutable: Admin siempre ON
    if (role === "Admin") return err(400, "Los permisos del Administrador son inmutables");

    // Inmutable: permisos de escritura de Invitado siempre OFF
    const WRITE_KEYS = ["TASK_CREATE","TASK_EDIT","TASK_CLOSE","TASK_REOPEN",
      "TASK_VIEW_ALL","TRANS_NEW_PROG","TRANS_PROG_RFT","TRANS_RFT_TEST",
      "TRANS_TEST_CLS","TRANS_BLOCK","TRANS_UNBLOCK"];
    if (role === "Invitado" && WRITE_KEYS.includes(key))
      return err(400, "Los permisos de escritura del rol Invitado son inmutables");

    const rp = store.rolePermissions as Record<string, Record<string, boolean>>;
    if (!rp[role]) return err(404, `Rol '${role}' no encontrado`);

    const before = { ...rp[role] };
    rp[role][key] = value;

    (store.auditLog as unknown[]).push({
      id: genId("audit"),
      category: "RBAC",
      action: "RBAC_PERMISSION_CHANGED",
      who: store.currentUser.id,
      whoRole: store.currentUser.roles[0],
      at: new Date().toISOString(),
      before: { role, key, value: before[key] },
      after: { role, key, value },
      description: `Permiso '${key}' del rol '${role}' → ${value ? "ON" : "OFF"}`,
    });
    return ok(store.rolePermissions);
  }),

  // ── POST /api/admin/role-permissions/reset ────────────
  http.post("/api/admin/role-permissions/reset", () => {
    if (!currentUserHasRole(["Admin"])) return err(403, "Solo el Administrador puede acceder");

    const RBAC_DEFAULTS: Record<string, Record<string, boolean>> = {
      "Admin":        { TASK_CREATE: true,  TASK_EDIT: true,  TASK_CLOSE: true,  TASK_REOPEN: true,  TASK_VIEW_ALL: true,  PROJECT_CREATE: true,  TRANS_NEW_PROG: true,  TRANS_PROG_RFT: true,  TRANS_RFT_TEST: true,  TRANS_TEST_CLS: true,  TRANS_BLOCK: true,  TRANS_UNBLOCK: true,  VIEW_DASHBOARD: true,  VIEW_PROJECTS: true,  VIEW_ROADMAP: true,  VIEW_GANTT: true,  VIEW_REQUESTS: true,  VIEW_BACKLOG: true,  VIEW_KANBAN: true,  VIEW_ACTIVITY: true,  VIEW_EVIDENCES: true,  VIEW_REPORTS: true,  VIEW_RISKS: true,  VIEW_AUDIT: true,  VIEW_HOME_SMART: true  },
      "IT AirEuropa": { TASK_CREATE: true,  TASK_EDIT: true,  TASK_CLOSE: true,  TASK_REOPEN: true,  TASK_VIEW_ALL: true,  PROJECT_CREATE: true,  TRANS_NEW_PROG: true,  TRANS_PROG_RFT: true,  TRANS_RFT_TEST: true,  TRANS_TEST_CLS: true,  TRANS_BLOCK: true,  TRANS_UNBLOCK: true,  VIEW_DASHBOARD: true,  VIEW_PROJECTS: true,  VIEW_ROADMAP: true,  VIEW_GANTT: true,  VIEW_REQUESTS: true,  VIEW_BACKLOG: true,  VIEW_KANBAN: true,  VIEW_ACTIVITY: true,  VIEW_EVIDENCES: true,  VIEW_REPORTS: true,  VIEW_RISKS: true,  VIEW_AUDIT: true,  VIEW_HOME_SMART: true  },
      "Proveedor":    { TASK_CREATE: false, TASK_EDIT: true,  TASK_CLOSE: false, TASK_REOPEN: false, TASK_VIEW_ALL: true,  PROJECT_CREATE: false, TRANS_NEW_PROG: true,  TRANS_PROG_RFT: true,  TRANS_RFT_TEST: false, TRANS_TEST_CLS: false, TRANS_BLOCK: true,  TRANS_UNBLOCK: true,  VIEW_DASHBOARD: true,  VIEW_PROJECTS: true,  VIEW_ROADMAP: false, VIEW_GANTT: false, VIEW_REQUESTS: true,  VIEW_BACKLOG: true,  VIEW_KANBAN: true,  VIEW_ACTIVITY: true,  VIEW_EVIDENCES: true,  VIEW_REPORTS: false, VIEW_RISKS: false, VIEW_AUDIT: false, VIEW_HOME_SMART: true  },
      "Usuario":      { TASK_CREATE: false, TASK_EDIT: false, TASK_CLOSE: false, TASK_REOPEN: false, TASK_VIEW_ALL: true,  PROJECT_CREATE: false, TRANS_NEW_PROG: false, TRANS_PROG_RFT: false, TRANS_RFT_TEST: false, TRANS_TEST_CLS: false, TRANS_BLOCK: false, TRANS_UNBLOCK: false, VIEW_DASHBOARD: true,  VIEW_PROJECTS: true,  VIEW_ROADMAP: true,  VIEW_GANTT: true,  VIEW_REQUESTS: true,  VIEW_BACKLOG: true,  VIEW_KANBAN: true,  VIEW_ACTIVITY: true,  VIEW_EVIDENCES: true,  VIEW_REPORTS: true,  VIEW_RISKS: false, VIEW_AUDIT: false, VIEW_HOME_SMART: true  },
      "Invitado":     { TASK_CREATE: false, TASK_EDIT: false, TASK_CLOSE: false, TASK_REOPEN: false, TASK_VIEW_ALL: false, PROJECT_CREATE: false, TRANS_NEW_PROG: false, TRANS_PROG_RFT: false, TRANS_RFT_TEST: false, TRANS_TEST_CLS: false, TRANS_BLOCK: false, TRANS_UNBLOCK: false, VIEW_DASHBOARD: true,  VIEW_PROJECTS: true,  VIEW_ROADMAP: false, VIEW_GANTT: false, VIEW_REQUESTS: false, VIEW_BACKLOG: true,  VIEW_KANBAN: true,  VIEW_ACTIVITY: false, VIEW_EVIDENCES: false, VIEW_REPORTS: false, VIEW_RISKS: false, VIEW_AUDIT: false, VIEW_HOME_SMART: false },
    };

    const before = structuredClone(store.rolePermissions);
    Object.assign(store.rolePermissions as Record<string, Record<string, boolean>>, RBAC_DEFAULTS);

    (store.auditLog as unknown[]).push({
      id: genId("audit"),
      category: "RBAC",
      action: "RBAC_RESET_TO_DEFAULTS",
      who: store.currentUser.id,
      whoRole: store.currentUser.roles[0],
      at: new Date().toISOString(),
      before,
      after: RBAC_DEFAULTS,
      description: "Permisos RBAC restaurados a valores por defecto",
    });
    return ok(store.rolePermissions);
  }),

  // ── GET /api/admin/audit-log ──────────────────────────
  http.get("/api/admin/audit-log", () => {
    if (!currentUserHasRole(["Admin", "IT AirEuropa"])) return err(403, "Sin permisos");
    return ok([...store.auditLog].reverse());
  }),

  // ── GET /api/audit — Auditoría formal unificada ────────
  // Fusiona auditLog (Admin/Settings/RBAC/User) + activityLog (WorkItem, Evidence, Risk, Project)
  http.get("/api/audit", ({ request }) => {
    if (!currentUserHasRole(["Admin", "IT AirEuropa"])) return err(403, "Sin permisos para acceder a la auditoría");

    const url         = new URL(request.url);
    const projectId   = url.searchParams.get("projectId")   ?? "";
    const entityType  = url.searchParams.get("entityType")  ?? "";
    const action      = url.searchParams.get("action")      ?? "";
    const actor       = url.searchParams.get("actor")       ?? "";
    const actorRole   = url.searchParams.get("actorRole")   ?? "";
    const fromDate    = url.searchParams.get("from")        ?? "";
    const toDate      = url.searchParams.get("to")          ?? "";
    const query       = (url.searchParams.get("query")      ?? "").toLowerCase().trim();
    const onlyCritical = url.searchParams.get("onlyCritical") === "true";

    const CRITICAL_ACTIONS = new Set([
      "RBAC_CHANGED", "RBAC_RESET_TO_DEFAULTS",
      "SETTINGS_CHANGED", "WIP_LIMIT_CHANGED",
      "USER_DEACTIVATED", "USER_CREATED",
    ]);

    // 1. Normalizar activityLog → AuditEntry
    type AuditEntry = {
      id: string; source: string; projectId: string; entityType: string;
      entityId: string; action: string; who: string; whoRole: string; at: string;
      from?: string; to?: string; note?: string;
      before?: Record<string, unknown>; after?: Record<string, unknown>;
      description?: string; isCritical: boolean;
    };

    const fromActivity: AuditEntry[] = (store.activityLog as Array<{
      id: string; projectId: string; entityType: string; entityId: string;
      action: string; from: string; to: string; who: string; whoRole: string; at: string; note?: string;
    }>).map((e) => {
      const critical =
        CRITICAL_ACTIONS.has(e.action) ||
        (e.action === "STATE_CHANGED" && (e.to === "Cerrado" || e.to === "Resuelto"));
      return {
        id:         e.id,
        source:     "activityLog",
        projectId:  e.projectId,
        entityType: e.entityType as AuditEntry["entityType"],
        entityId:   e.entityId,
        action:     e.action,
        who:        e.who,
        whoRole:    e.whoRole,
        at:         e.at,
        from:       e.from,
        to:         e.to,
        note:       e.note,
        isCritical: critical,
      };
    });

    // 2. Normalizar auditLog → AuditEntry
    const fromAudit: AuditEntry[] = (store.auditLog as Array<{
      id: string; category: string; action: string; who: string; whoRole: string;
      at: string; before: Record<string, unknown>; after: Record<string, unknown>;
      description: string;
    }>).map((e) => ({
      id:         e.id,
      source:     "auditLog",
      projectId:  "",
      entityType: e.category,
      entityId:   e.category.toLowerCase(),
      action:     e.action,
      who:        e.who,
      whoRole:    e.whoRole,
      at:         e.at,
      from:       JSON.stringify(e.before ?? {}),
      to:         JSON.stringify(e.after ?? {}),
      note:       e.description,
      before:     e.before,
      after:      e.after,
      description: e.description,
      isCritical: true,
    }));

    // 3. También incluir risks del activityLog con entityType="Risk"
    const fromRisks: AuditEntry[] = (store.activityLog as AuditEntry[]).filter(
      (e) => e.entityType === "Risk",
    );

    let unified: AuditEntry[] = [...fromActivity, ...fromAudit];
    // Evitar duplicados de risk (ya en fromActivity)
    const seen = new Set(unified.map((e) => e.id));
    fromRisks.forEach((e) => { if (!seen.has(e.id)) unified.push(e); });

    // 4. Aplicar filtros
    if (projectId)  unified = unified.filter((e) => e.projectId === projectId);
    if (entityType) unified = unified.filter((e) => e.entityType === entityType);
    if (action)     unified = unified.filter((e) => e.action === action);
    if (actor)      unified = unified.filter((e) => e.who === actor || (e.who ?? "").toLowerCase().includes(actor.toLowerCase()));
    if (actorRole)  unified = unified.filter((e) => e.whoRole === actorRole);
    if (fromDate)   unified = unified.filter((e) => new Date(e.at) >= new Date(fromDate));
    if (toDate) {
      const end = new Date(toDate);
      end.setHours(23, 59, 59, 999);
      unified = unified.filter((e) => new Date(e.at) <= end);
    }
    if (onlyCritical) unified = unified.filter((e) => e.isCritical);
    if (query) {
      unified = unified.filter((e) =>
        e.entityId.toLowerCase().includes(query) ||
        (e.projectId ?? "").toLowerCase().includes(query) ||
        (e.note ?? "").toLowerCase().includes(query) ||
        (e.description ?? "").toLowerCase().includes(query) ||
        (e.from ?? "").toLowerCase().includes(query) ||
        (e.to ?? "").toLowerCase().includes(query) ||
        e.action.toLowerCase().includes(query) ||
        e.who.toLowerCase().includes(query),
      );
    }

    // 5. Ordenar por fecha descendente
    unified.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());

    return ok(unified);
  }),

  // ──────────────────────────────────────────────────────
  //  GESTIÓN DE USUARIOS DE APLICACIÓN
  // ──────────────────────────────────────────────────────

  // ── GET /api/admin/users ──────────────────────────────
  http.get("/api/admin/users", ({ request }) => {
    if (!currentUserHasRole(["Admin"])) return err(403, "Solo el Administrador puede acceder");
    const url    = new URL(request.url);
    const query  = (url.searchParams.get("query") ?? "").toLowerCase();
    const role   = url.searchParams.get("role")   ?? "";
    const status = url.searchParams.get("status") ?? "";
    const teamId = url.searchParams.get("teamId") ?? "";

    const users = store.appUsers as Array<Record<string, unknown>>;
    const filtered = users.filter((u) => {
      const matchQ = !query ||
        (u.displayName as string).toLowerCase().includes(query) ||
        (u.email as string).toLowerCase().includes(query) ||
        (u.upn as string).toLowerCase().includes(query);
      const matchR = !role || u.role === role;
      const matchS = !status
        ? true
        : status === "active"   ? u.isActive === true
        : status === "inactive" ? u.isActive === false
        : true;
      const matchT = !teamId || ((u.teamIds as string[]) ?? []).includes(teamId);
      return matchQ && matchR && matchS && matchT;
    });
    return ok(filtered);
  }),

  // ── POST /api/admin/users ─────────────────────────────
  http.post("/api/admin/users", async ({ request }) => {
    if (!currentUserHasRole(["Admin"])) return err(403, "Solo el Administrador puede acceder");
    const body = await request.json() as Record<string, unknown>;
    const { displayName, email, upn, role, teamIds } = body as {
      displayName: string; email: string; upn: string; role: string; teamIds?: string[];
    };

    // Validar duplicado por UPN
    const users = store.appUsers as Array<Record<string, unknown>>;
    const existing = users.find((u) => (u.upn as string).toLowerCase() === upn?.toLowerCase());
    if (existing) return err(409, `El usuario '${upn}' ya existe en la aplicación`);

    // Validar: Proveedor necesita al menos 1 equipo de tipo Provider
    if (role === "Proveedor") {
      const providerTeams = (store.teams as Team[]).filter((t) => t.type === "Provider");
      const ids = teamIds ?? [];
      if (!providerTeams.some((t) => ids.includes(t.id))) {
        return err(400, "Un Proveedor debe pertenecer al menos a un equipo de tipo 'Proveedor'");
      }
    }

    const now = new Date().toISOString();
    const newUser = {
      id: genId("au"), displayName, email, upn, role,
      teamIds: teamIds ?? [],
      isActive: true, createdOn: now, updatedOn: now,
    };
    users.push(newUser);

    (store.auditLog as unknown[]).push({
      id: genId("audit"), category: "User", action: "USER_CREATED",
      who: store.currentUser.id, whoRole: store.currentUser.roles[0],
      at: now, before: {}, after: newUser,
      description: `Usuario '${displayName}' añadido con rol '${role}'`,
    });
    return ok(newUser);
  }),

  // ── PATCH /api/admin/users/:id ────────────────────────
  http.patch("/api/admin/users/:id", async ({ params, request }) => {
    if (!currentUserHasRole(["Admin"])) return err(403, "Solo el Administrador puede acceder");
    const users = store.appUsers as Array<Record<string, unknown>>;
    const idx = users.findIndex((u) => u.id === params.id);
    if (idx === -1) return err(404, "Usuario no encontrado");

    const body   = await request.json() as Record<string, unknown>;
    const before = { ...users[idx] };
    Object.assign(users[idx], body, { updatedOn: new Date().toISOString() });

    (store.auditLog as unknown[]).push({
      id: genId("audit"), category: "User", action: "USER_UPDATED",
      who: store.currentUser.id, whoRole: store.currentUser.roles[0],
      at: new Date().toISOString(), before, after: { ...users[idx] },
      description: `Usuario '${users[idx].displayName}' actualizado`,
    });
    return ok(users[idx]);
  }),

  // ── POST /api/admin/users/:id/activate ───────────────
  http.post("/api/admin/users/:id/activate", ({ params }) => {
    if (!currentUserHasRole(["Admin"])) return err(403, "Solo el Administrador puede acceder");
    const users = store.appUsers as Array<Record<string, unknown>>;
    const u = users.find((x) => x.id === params.id);
    if (!u) return err(404, "Usuario no encontrado");
    const before = { ...u };
    u.isActive  = true;
    u.updatedOn = new Date().toISOString();
    (store.auditLog as unknown[]).push({
      id: genId("audit"), category: "User", action: "USER_ACTIVATED",
      who: store.currentUser.id, whoRole: store.currentUser.roles[0],
      at: u.updatedOn as string, before, after: { ...u },
      description: `Usuario '${u.displayName}' activado`,
    });
    return ok(u);
  }),

  // ── POST /api/admin/users/:id/deactivate ─────────────
  http.post("/api/admin/users/:id/deactivate", ({ params }) => {
    if (!currentUserHasRole(["Admin"])) return err(403, "Solo el Administrador puede acceder");
    const users = store.appUsers as Array<Record<string, unknown>>;
    const u = users.find((x) => x.id === params.id);
    if (!u) return err(404, "Usuario no encontrado");
    const before = { ...u };
    u.isActive  = false;
    u.updatedOn = new Date().toISOString();
    (store.auditLog as unknown[]).push({
      id: genId("audit"), category: "User", action: "USER_DEACTIVATED",
      who: store.currentUser.id, whoRole: store.currentUser.roles[0],
      at: u.updatedOn as string, before, after: { ...u },
      description: `Usuario '${u.displayName}' desactivado`,
    });
    return ok(u);
  }),

  // ── GET /api/admin/tenant-users?q= ───────────────────
  // People picker: busca usuarios del tenant (mock de Graph People API)
  http.get("/api/admin/tenant-users", ({ request }) => {
    if (!currentUserHasRole(["Admin"])) return err(403, "Solo el Administrador puede acceder");
    const q = (new URL(request.url).searchParams.get("q") ?? "").toLowerCase();
    if (!q || q.length < 2) return ok([]);
    const results = (store.tenantUsers as Array<Record<string, unknown>>)
      .filter((u) =>
        (u.displayName as string).toLowerCase().includes(q) ||
        (u.upn as string).toLowerCase().includes(q) ||
        (u.email as string).toLowerCase().includes(q)
      )
      .slice(0, 8);
    return ok(results);
  }),

  // ── GET /api/admin/providers ──────────────────────────
  http.get("/api/admin/providers", () => {
    if (!currentUserHasRole(["Admin"])) return err(403, "Solo el Administrador puede acceder");
    return ok(store.providers ?? []);
  }),

  // ── POST /api/admin/providers ─────────────────────────
  http.post("/api/admin/providers", async ({ request }) => {
    if (!currentUserHasRole(["Admin"])) return err(403, "Solo el Administrador puede acceder");
    const body = await request.json() as { name?: string; isActive?: boolean };
    if (!body.name?.trim()) return err(400, "El nombre del proveedor es obligatorio");

    const providers = (store.providers ?? []) as Array<Record<string, unknown>>;
    const dup = providers.find((p) => (p.name as string).toLowerCase() === body.name!.trim().toLowerCase());
    if (dup) return err(409, `Ya existe un proveedor con el nombre '${body.name}'`);

    const now = new Date().toISOString();
    const slug = body.name!.trim().toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
    const newP = {
      id: `prov-${slug}-${Date.now().toString(36)}`,
      name: body.name!.trim(),
      isActive: body.isActive !== false,
      createdOn: now,
      updatedOn: now,
    };
    providers.push(newP);
    if (!store.providers) (store as Record<string, unknown>).providers = providers;
    return ok(newP);
  }),

  // ── PATCH /api/admin/providers/:id ────────────────────
  http.patch("/api/admin/providers/:id", async ({ params, request }) => {
    if (!currentUserHasRole(["Admin"])) return err(403, "Solo el Administrador puede acceder");
    const providers = (store.providers ?? []) as Array<Record<string, unknown>>;
    const idx = providers.findIndex((p) => p.id === params.id);
    if (idx === -1) return err(404, "Proveedor no encontrado");

    const body = await request.json() as { name?: string; isActive?: boolean };
    if (body.name !== undefined) {
      if (!body.name.trim()) return err(400, "El nombre no puede estar vacío");
      const dup = providers.find(
        (p, i) => i !== idx && (p.name as string).toLowerCase() === body.name!.trim().toLowerCase(),
      );
      if (dup) return err(409, `Ya existe un proveedor con el nombre '${body.name}'`);
      providers[idx].name = body.name.trim();
    }
    if (body.isActive !== undefined) providers[idx].isActive = body.isActive;
    providers[idx].updatedOn = new Date().toISOString();
    return ok(providers[idx]);
  }),

  // ── GET /api/settings (público — Kanban, Backlog lo usan) ───────────
  // Devuelve settings + wipLimits sin restricción de rol.
  http.get("/api/settings", () =>
    ok({
      strictValidation: (store.settings as Record<string, unknown>).strictValidation ?? false,
      adminBypass:      (store.settings as Record<string, unknown>).adminBypass      ?? false,
      jiraSyncEnabled:  (store.settings as Record<string, unknown>).jiraSyncEnabled  ?? true,
      wipLimits:        store.wipLimits,
    }),
  ),

  // ── POST /api/ui-events ───────────────────────────────
  // Telemetría UX — NO es auditoría formal, solo registro en memoria.
  // Body: { entityId, action, fromStateId, toStateId, whoRole, meta? }
  http.post("/api/ui-events", async ({ request }) => {
    const body = await request.json() as Record<string, unknown>;
    if (!body.entityId || !body.action) return err(400, "entityId y action son obligatorios");

    if (!store.uiEvents) {
      (store as Record<string, unknown>).uiEvents = [];
    }
    const event = {
      id:          genId("uiev"),
      entityType:  "WorkItem",
      entityId:    body.entityId,
      action:      body.action,
      fromStateId: body.fromStateId ?? "",
      toStateId:   body.toStateId   ?? "",
      who:         store.currentUser.id,
      whoRole:     body.whoRole ?? (store.currentUser.roles[0] as string),
      timestamp:   new Date().toISOString(),
      meta:        body.meta ?? {},
    };
    (store.uiEvents as unknown[]).push(event);
    return ok({ ok: true, id: event.id });
  }),

  // ── PATCH /api/workitems/order ────────────────────────
  // Reordena WorkItems del Backlog. Recibe { ids: string[] }
  // y reorganiza store.workItems manteniendo el orden dado.
  http.patch("/api/workitems/order", async ({ request }) => {
    const roles = store.currentUser.roles as AppRole[];
    const canReorder =
      roles.includes("Admin") ||
      roles.includes("IT AirEuropa") ||
      roles.includes("Proveedor");
    if (!canReorder) return err(403, "Sin permisos para reordenar tareas");

    const body = await request.json() as { ids?: string[] };
    if (!Array.isArray(body?.ids)) return err(400, "Se requiere { ids: string[] }");

    const ids = body.ids;
    const itemMap = new Map(
      (store.workItems as WorkItem[]).map((w) => [w.id, w]),
    );

    // Colocar los ítems del array al principio en el orden indicado,
    // el resto (si los hay) se añaden al final sin cambio de posición.
    const reordered: WorkItem[] = [];
    ids.forEach((id) => {
      const item = itemMap.get(id);
      if (item) { reordered.push(item); itemMap.delete(id); }
    });
    itemMap.forEach((item) => reordered.push(item));

    (store as typeof store).workItems = reordered;

    return ok({ success: true, count: ids.length });
  }),

  // ── GET /api/appusers ─────────────────────────────────
  // Devuelve la lista de usuarios de la app (para el switcher de simulación).
  // Soporta ?query= para búsqueda por nombre/email.
  http.get("/api/appusers", ({ request }) => {
    const url = new URL(request.url);
    const query = (url.searchParams.get("query") ?? "").toLowerCase().trim();
    const users = store.appUsers as Array<{
      id: string; displayName: string; email: string;
      upn: string; role: string; isActive: boolean;
    }>;
    const result = query
      ? users.filter(u =>
          u.displayName.toLowerCase().includes(query) ||
          u.email.toLowerCase().includes(query),
        )
      : users;
    return ok(result);
  }),

  // ── GET /api/requests ────────────────────────────────
  http.get("/api/requests", ({ request }) => {
    const user = store.currentUser as AppUser;
    const role = (user.role ?? (user as unknown as { roles: string[] }).roles?.[0]) as AppRole;
    const url  = new URL(request.url);

    const yearStr   = url.searchParams.get("year") ?? "";
    const status    = url.searchParams.get("status") ?? "";
    const type      = url.searchParams.get("type") ?? "";
    const priority  = url.searchParams.get("priority") ?? "";
    const query     = (url.searchParams.get("query") ?? "").toLowerCase();
    const mineOnly  = url.searchParams.get("mine") === "true";

    type Req = typeof store.requests[0];
    let items = (store.requests as Req[]).slice();

    // Filtro de año
    if (yearStr) items = items.filter(r => r.year === parseInt(yearStr, 10));

    // Scope por rol:
    // Proveedor → solo sus requests (por requestedByUserId o por equipo)
    // Usuario   → solo sus requests
    // IT / Admin → todo
    if (role === "Proveedor") {
      items = items.filter(r =>
        r.requestedByUserId === user.id ||
        (user.teamIds ?? []).includes(r.requestedByTeamId ?? ""),
      );
    } else if (role === "Usuario") {
      items = items.filter(r =>
        r.requestedByUserId === user.id ||
        (user.teamIds ?? []).includes(r.requestedByTeamId ?? ""),
      );
    }
    // Admin / IT ven todo

    if (mineOnly) items = items.filter(r => r.requestedByUserId === user.id);
    if (status)   items = items.filter(r => r.status === status);
    if (type)     items = items.filter(r => r.type === type);
    if (priority) items = items.filter(r => r.priority === priority);
    if (query)    items = items.filter(r =>
      r.title.toLowerCase().includes(query) ||
      r.description.toLowerCase().includes(query),
    );

    // Orden: más reciente primero
    items.sort((a, b) => b.createdOn.localeCompare(a.createdOn));

    return ok(items);
  }),

  // ── POST /api/requests ──────────────────────────────
  http.post("/api/requests", async ({ request }) => {
    const user = store.currentUser as AppUser;
    const role = (user.role ?? (user as unknown as { roles: string[] }).roles?.[0]) as AppRole;

    // Solo Usuario, Proveedor, IT y Admin pueden crear solicitudes
    const canCreate: AppRole[] = ["Admin", "IT AirEuropa", "Usuario", "Proveedor"];
    if (!canCreate.includes(role)) return err(403, "Sin permisos para crear solicitudes");

    const body = await request.json() as Record<string, unknown>;
    if (!body.title || !body.type || !body.priority) {
      return err(400, "Campos obligatorios: title, type, priority");
    }

    const now = new Date().toISOString();
    const year = typeof body.year === "number" ? body.year : new Date(now).getFullYear();
    const newReq = {
      id:                  genId("req"),
      year,
      title:               String(body.title),
      description:         String(body.description ?? ""),
      type:                body.type,
      priority:            body.priority,
      requestedByUserId:   user.id,
      requestedByRole:     role,
      requestedByTeamId:   body.requestedByTeamId ?? null,
      relatedProjectId:    body.relatedProjectId ?? null,
      status:              "Nuevo",
      triageOwnerUserId:   null,
      triageNote:          null,
      createdOn:           now,
      updatedOn:           now,
      convertedWorkItemId: null,
      cancelledNote:       null,
    };

    (store.requests as typeof store.requests).push(newReq as typeof store.requests[0]);
    return HttpResponse.json(newReq, { status: 201 });
  }),

  // ── PATCH /api/requests/:id ──────────────────────────
  http.patch("/api/requests/:id", async ({ params, request }) => {
    const user = store.currentUser as AppUser;
    const role = (user.role ?? (user as unknown as { roles: string[] }).roles?.[0]) as AppRole;

    const idx = (store.requests as typeof store.requests).findIndex(r => r.id === params.id);
    if (idx === -1) return err(404, "Solicitud no encontrada");

    const req = store.requests[idx];
    const body = await request.json() as Record<string, unknown>;

    // Permisos de edición:
    // - Solicitante puede editar solo si status ∈ [Nuevo, Info requerida] y es el autor
    // - IT/Admin pueden editar cualquier campo (triage)
    const isOwner = req.requestedByUserId === user.id;
    const isIT    = role === "Admin" || role === "IT AirEuropa";
    const editableStatuses: string[] = ["Nuevo", "Info requerida"];

    if (!isIT && !(isOwner && editableStatuses.includes(req.status))) {
      return err(403, "No tienes permiso para editar esta solicitud en su estado actual");
    }

    const now = new Date().toISOString();
    const updated = { ...req, ...body, id: req.id, updatedOn: now };
    (store.requests as typeof store.requests)[idx] = updated as typeof store.requests[0];

    return ok(updated);
  }),

  // ── POST /api/requests/:id/triage ───────────────────
  // IT/Admin toman la solicitud y cambian su estado.
  // body: { action: "review"|"request-info"|"approve"|"reject", note?: string }
  http.post("/api/requests/:id/triage", async ({ params, request }) => {
    const user = store.currentUser as AppUser;
    const role = (user.role ?? (user as unknown as { roles: string[] }).roles?.[0]) as AppRole;
    if (role !== "Admin" && role !== "IT AirEuropa") {
      return err(403, "Solo IT/Admin pueden realizar el triage de solicitudes");
    }

    const idx = (store.requests as typeof store.requests).findIndex(r => r.id === params.id);
    if (idx === -1) return err(404, "Solicitud no encontrada");

    const body = await request.json() as { action: string; note?: string };
    const ACTION_STATUS: Record<string, string> = {
      "review":       "En revisión",
      "request-info": "Info requerida",
      "approve":      "Aprobada",
      "reject":       "Rechazada",
    };
    const newStatus = ACTION_STATUS[body.action];
    if (!newStatus) return err(400, `Acción desconocida: ${body.action}`);

    // Nota obligatoria para acciones que la requieren
    if ((body.action === "reject" || body.action === "request-info") && !body.note?.trim()) {
      return err(400, body.action === "reject"
        ? "El motivo de rechazo es obligatorio"
        : "La nota de información es obligatoria");
    }

    const now = new Date().toISOString();
    const updated = {
      ...store.requests[idx],
      status:           newStatus,
      triageOwnerUserId: user.id,
      triageNote:       body.note ?? store.requests[idx].triageNote ?? null,
      updatedOn:        now,
    };
    (store.requests as typeof store.requests)[idx] = updated as typeof store.requests[0];

    return ok(updated);
  }),

  // ── POST /api/requests/:id/convert ──────────────────
  // IT/Admin convierten una solicitud aprobada en WorkItem.
  // body: { projectId, title?, type?, priority?, assignedToUserId?, assignedToTeamId? }
  http.post("/api/requests/:id/convert", async ({ params, request }) => {
    const user = store.currentUser as AppUser;
    const role = (user.role ?? (user as unknown as { roles: string[] }).roles?.[0]) as AppRole;
    if (role !== "Admin" && role !== "IT AirEuropa") {
      return err(403, "Solo IT/Admin pueden convertir solicitudes");
    }

    const idx = (store.requests as typeof store.requests).findIndex(r => r.id === params.id);
    if (idx === -1) return err(404, "Solicitud no encontrada");

    const req = store.requests[idx];
    if (req.status !== "Aprobada") {
      return err(422, "Solo se pueden convertir solicitudes en estado Aprobada");
    }

    const body = await request.json() as {
      projectId: string;
      title?: string;
      type?: string;
      priority?: string;
      assignedToUserId?: string;
      assignedToTeamId?: string | null;
    };
    if (!body.projectId) return err(400, "Se requiere projectId");

    const now = new Date().toISOString();

    // Mapear RequestType → WorkItemType
    const typeMap: Record<string, string> = {
      Bug: "Bug", Feature: "Feature", Mejora: "Feature",
      Incidencia: "Bug", Consulta: "Spike", CambioNormativo: "TechDebt", Impedimento: "Bug",
    };
    const wiType = (body.type ?? typeMap[req.type] ?? "Feature") as WorkItem["type"];

    const newWI: WorkItem = {
      id:                genId("wi"),
      code:              `WI-${Math.floor(Math.random() * 9000) + 1000}`,
      projectId:         body.projectId,
      title:             body.title ?? req.title,
      description:       req.description,
      type:              wiType,
      priority:          (body.priority ?? req.priority) as WorkItem["priority"],
      stateId:           "st-new",
      assignedToRole:    "IT AirEuropa",
      assignedToTeamId:  body.assignedToTeamId ?? null,
      assignedToUserId:  body.assignedToUserId ?? user.id,
      startDate:         now.slice(0, 10),
      endDate:           null,
      tags:              [],
      syncStatus:        "OK",
      blockedReason:     null,
      createdOn:         now,
      updatedOn:         now,
    } as unknown as WorkItem;

    (store.workItems as WorkItem[]).push(newWI);

    // Marcar la solicitud como Convertida
    const updatedReq = {
      ...req,
      status:              "Convertida",
      convertedWorkItemId: newWI.id,
      updatedOn:           now,
    };
    (store.requests as typeof store.requests)[idx] = updatedReq as typeof store.requests[0];

    return HttpResponse.json({ request: updatedReq, workItem: newWI }, { status: 201 });
  }),

  // ── POST /api/requests/:id/cancel ─────────────────────────
  // Solicitante o IT/Admin cancelan (status ∈ Nuevo / Info requerida / En revisión).
  http.post("/api/requests/:id/cancel", async ({ params, request }) => {
    const user = store.currentUser as AppUser;
    const role = (user.role ?? (user as unknown as { roles: string[] }).roles?.[0]) as AppRole;

    const idx = (store.requests as typeof store.requests).findIndex(r => r.id === params.id);
    if (idx === -1) return err(404, "Solicitud no encontrada");

    const req = store.requests[idx];
    const isOwner = req.requestedByUserId === user.id;
    const isIT    = role === "Admin" || role === "IT AirEuropa";

    const cancellable: string[] = ["Nuevo", "Info requerida", "En revisión"];
    if (!cancellable.includes(req.status)) {
      return err(422, `No se puede cancelar una solicitud en estado ${req.status}`);
    }
    if (!isOwner && !isIT) {
      return err(403, "Solo el solicitante o IT puede cancelar esta solicitud");
    }

    const body = await request.json() as { note?: string };
    const now = new Date().toISOString();
    const updated = {
      ...req,
      status:        "Cancelada",
      cancelledNote: body.note ?? null,
      updatedOn:     now,
    };
    (store.requests as typeof store.requests)[idx] = updated as typeof store.requests[0];
    return ok(updated);
  }),

  // ── POST /api/requests/:id/respond ────────────────────────
  // Solicitante responde a "Info requerida" → status vuelve a "En revisión".
  http.post("/api/requests/:id/respond", async ({ params, request }) => {
    const user = store.currentUser as AppUser;

    const idx = (store.requests as typeof store.requests).findIndex(r => r.id === params.id);
    if (idx === -1) return err(404, "Solicitud no encontrada");

    const req = store.requests[idx];
    if (req.status !== "Info requerida") {
      return err(422, "Solo se puede responder cuando la solicitud está en 'Info requerida'");
    }
    if (req.requestedByUserId !== user.id) {
      return err(403, "Solo el solicitante puede responder a esta solicitud");
    }

    const body = await request.json() as { note: string };
    if (!body.note?.trim()) return err(400, "La respuesta no puede estar vacía");

    const now = new Date().toISOString();
    const responseText = `[Respuesta del solicitante] ${body.note.trim()}`;
    const updated = {
      ...req,
      status:    "En revisión",
      triageNote: req.triageNote ? `${req.triageNote}\n\n${responseText}` : responseText,
      updatedOn: now,
    };
    (store.requests as typeof store.requests)[idx] = updated as typeof store.requests[0];
    return ok(updated);
  }),

  // ══════════════════════════════════════════════════════
  //  PERMISSION PROFILES
  // ══════════════════════════════════════════════════════

  // ── GET /api/permission-profiles ─────────────────────
  http.get("/api/permission-profiles", () => {
    if (!currentUserHasRole(["Admin"])) return err(403, "Solo Admin");
    return ok(store.permissionProfiles ?? []);
  }),

  // ── POST /api/permission-profiles ────────────────────
  http.post("/api/permission-profiles", async ({ request }) => {
    if (!currentUserHasRole(["Admin"])) return err(403, "Solo Admin");
    const body = await request.json() as { name?: string; label?: string; description?: string };
    if (!body.name?.trim() || !body.label?.trim()) return err(400, "name y label son obligatorios");
    const profiles = (store.permissionProfiles ?? []) as Array<Record<string, unknown>>;
    const dup = profiles.find((p) => (p.name as string).toLowerCase() === body.name!.toLowerCase());
    if (dup) return err(409, `Ya existe un perfil con el nombre '${body.name}'`);
    const profile = {
      id:          genId("pp"),
      name:        body.name!.trim(),
      label:       body.label!.trim(),
      description: body.description?.trim() ?? "",
      isActive:    true,
      createdOn:   new Date().toISOString(),
    };
    profiles.push(profile);
    return HttpResponse.json(profile, { status: 201 });
  }),

  // ── PATCH /api/permission-profiles/:id ───────────────
  http.patch("/api/permission-profiles/:id", async ({ params, request }) => {
    if (!currentUserHasRole(["Admin"])) return err(403, "Solo Admin");
    const profiles = (store.permissionProfiles ?? []) as Array<Record<string, unknown>>;
    const idx = profiles.findIndex((p) => p.id === params.id);
    if (idx === -1) return err(404, "Perfil no encontrado");
    const body = await request.json() as Partial<{ name: string; label: string; description: string; isActive: boolean }>;
    Object.assign(profiles[idx], body);
    return ok(profiles[idx]);
  }),

  // ── GET /api/profile-permissions ─────────────────────
  http.get("/api/profile-permissions", () => {
    if (!currentUserHasRole(["Admin"])) return err(403, "Solo Admin");
    return ok(store.profilePermissions ?? []);
  }),

  // ── POST /api/profile-permissions ────────────────────
  http.post("/api/profile-permissions", async ({ request }) => {
    if (!currentUserHasRole(["Admin"])) return err(403, "Solo Admin");
    const body = await request.json() as { profileId?: string; permissionKey?: string };
    if (!body.profileId || !body.permissionKey) return err(400, "profileId y permissionKey son obligatorios");
    const entries = (store.profilePermissions ?? []) as Array<Record<string, unknown>>;
    const dup = entries.find((e) => e.profileId === body.profileId && e.permissionKey === body.permissionKey);
    if (dup) return err(409, "Ese permiso ya está en el perfil");
    const entry = { id: genId("pperm"), profileId: body.profileId, permissionKey: body.permissionKey };
    entries.push(entry);
    return HttpResponse.json(entry, { status: 201 });
  }),

  // ── DELETE /api/profile-permissions/:id ──────────────
  http.delete("/api/profile-permissions/:id", ({ params }) => {
    if (!currentUserHasRole(["Admin"])) return err(403, "Solo Admin");
    const entries = (store.profilePermissions ?? []) as Array<Record<string, unknown>>;
    const idx = entries.findIndex((e) => e.id === params.id);
    if (idx === -1) return err(404, "Entrada no encontrada");
    entries.splice(idx, 1);
    return ok({ ok: true });
  }),

  // ══════════════════════════════════════════════════════
  //  USER PROFILES & OVERRIDES
  // ══════════════════════════════════════════════════════

  // ── GET /api/users/:userId/effective-permissions ──────
  // Resuelve el mapa completo de permisos para un usuario:
  //   1) Admin → todo true
  //   2) Base rol
  //   3) Perfiles asignados (aditivos)
  //   4) Overrides por usuario (Admin puede elevar/revocar)
  http.get("/api/users/:userId/effective-permissions", ({ params }) => {
    const userId = params.userId as string;
    const users  = store.appUsers as Array<Record<string, unknown>>;
    const user   = users.find((u) => u.id === userId);
    if (!user) return err(404, "Usuario no encontrado");

    const role       = user.role as string;
    const allKeys    = (store.rbacPermissions as Array<{ key: string }>).map((p) => p.key);

    // 1. Admin bypass — todo true
    if (role === "Admin") {
      const perms = Object.fromEntries(allKeys.map((k) => [k, true]));
      return ok({ permissions: perms, fromProfiles: [], overrides: {} });
    }

    // 2. Base por rol
    const roleMap = store.rolePermissions as Record<string, Record<string, boolean>>;
    const perms   = { ...(roleMap[role] ?? {}) };
    // Asegurar que todas las claves existen (puede haber claves nuevas no en el mapa antiguo)
    for (const k of allKeys) { if (!(k in perms)) perms[k] = false; }

    // 3. Perfiles del usuario (aditivos — nunca revocan)
    const fromProfiles: string[] = [];
    const userProfileEntries = (store.userProfiles ?? []) as Array<Record<string, unknown>>;
    const profilePermEntries = (store.profilePermissions ?? []) as Array<Record<string, unknown>>;
    const allProfiles        = (store.permissionProfiles ?? []) as Array<Record<string, unknown>>;

    for (const up of userProfileEntries.filter((e) => e.userId === userId)) {
      const profile = allProfiles.find((p) => p.id === up.profileId && p.isActive);
      if (!profile) continue;
      for (const pp of profilePermEntries.filter((pp) => pp.profileId === up.profileId)) {
        const key = pp.permissionKey as string;
        if (!perms[key]) {
          perms[key] = true;
          fromProfiles.push(key);
        }
      }
    }

    // 4. Overrides por usuario (pueden elevar O revocar)
    const overrides: Record<string, boolean> = {};
    for (const ov of ((store.userPermissionOverrides ?? []) as Array<Record<string, unknown>>)
      .filter((o) => o.userId === userId)) {
      const key = ov.permissionKey as string;
      const val = ov.value as boolean;
      perms[key]   = val;
      overrides[key] = val;
    }

    return ok({ permissions: perms, fromProfiles, overrides });
  }),

  // ── GET /api/users/:userId/profiles ──────────────────
  http.get("/api/users/:userId/profiles", ({ params }) => {
    if (!currentUserHasRole(["Admin"])) return err(403, "Solo Admin");
    const entries = (store.userProfiles ?? []) as Array<Record<string, unknown>>;
    return ok(entries.filter((e) => e.userId === params.userId));
  }),

  // ── POST /api/users/:userId/profiles ─────────────────
  http.post("/api/users/:userId/profiles", async ({ params, request }) => {
    if (!currentUserHasRole(["Admin"])) return err(403, "Solo Admin");
    const body = await request.json() as { profileId?: string };
    if (!body.profileId) return err(400, "profileId es obligatorio");
    const entries = (store.userProfiles ?? []) as Array<Record<string, unknown>>;
    const dup = entries.find((e) => e.userId === params.userId && e.profileId === body.profileId);
    if (dup) return err(409, "El usuario ya tiene ese perfil asignado");
    const entry = {
      id:         genId("up"),
      userId:     params.userId,
      profileId:  body.profileId,
      assignedBy: store.currentUser.id,
      assignedOn: new Date().toISOString(),
    };
    entries.push(entry);
    // Sincronizar profileIds en appUsers
    const users = store.appUsers as Array<Record<string, unknown>>;
    const uIdx = users.findIndex((u) => u.id === params.userId);
    if (uIdx >= 0) {
      const existing = (users[uIdx].profileIds ?? []) as string[];
      if (!existing.includes(body.profileId)) {
        users[uIdx].profileIds = [...existing, body.profileId];
        users[uIdx].updatedOn  = new Date().toISOString();
      }
    }
    // Auditoría
    (store.auditLog as unknown[]).push({
      id: genId("audit"), category: "PROFILE",
      action: "PROFILE_ASSIGNED",
      who: store.currentUser.id, whoRole: store.currentUser.roles[0],
      at: new Date().toISOString(),
      before: {}, after: { userId: params.userId, profileId: body.profileId },
      description: `Perfil '${body.profileId}' asignado a usuario '${params.userId}'`,
    });
    return HttpResponse.json(entry, { status: 201 });
  }),

  // ── DELETE /api/users/:userId/profiles/:profileId ─────
  http.delete("/api/users/:userId/profiles/:profileId", ({ params }) => {
    if (!currentUserHasRole(["Admin"])) return err(403, "Solo Admin");
    const entries = (store.userProfiles ?? []) as Array<Record<string, unknown>>;
    const idx = entries.findIndex((e) => e.userId === params.userId && e.profileId === params.profileId);
    if (idx === -1) return err(404, "Asignación no encontrada");
    entries.splice(idx, 1);
    // Sincronizar profileIds en appUsers
    const users = store.appUsers as Array<Record<string, unknown>>;
    const uIdx = users.findIndex((u) => u.id === params.userId);
    if (uIdx >= 0) {
      users[uIdx].profileIds = ((users[uIdx].profileIds ?? []) as string[]).filter((id) => id !== params.profileId);
      users[uIdx].updatedOn  = new Date().toISOString();
    }
    // Auditoría
    (store.auditLog as unknown[]).push({
      id: genId("audit"), category: "PROFILE",
      action: "PROFILE_REMOVED",
      who: store.currentUser.id, whoRole: store.currentUser.roles[0],
      at: new Date().toISOString(),
      before: { userId: params.userId, profileId: params.profileId }, after: {},
      description: `Perfil '${params.profileId}' retirado de usuario '${params.userId}'`,
    });
    return ok({ ok: true });
  }),

  // ── GET /api/users/:userId/overrides ──────────────────
  http.get("/api/users/:userId/overrides", ({ params }) => {
    if (!currentUserHasRole(["Admin"])) return err(403, "Solo Admin");
    const entries = (store.userPermissionOverrides ?? []) as Array<Record<string, unknown>>;
    return ok(entries.filter((e) => e.userId === params.userId));
  }),

  // ── POST /api/users/:userId/overrides ─────────────────
  http.post("/api/users/:userId/overrides", async ({ params, request }) => {
    if (!currentUserHasRole(["Admin"])) return err(403, "Solo Admin puede establecer overrides");
    const body = await request.json() as { permissionKey?: string; value?: boolean; reason?: string };
    if (!body.permissionKey || body.value === undefined || !body.reason?.trim())
      return err(400, "permissionKey, value y reason son obligatorios");
    const entries = (store.userPermissionOverrides ?? []) as Array<Record<string, unknown>>;
    // Upsert: si ya existe, actualizar
    const existing = entries.find((e) => e.userId === params.userId && e.permissionKey === body.permissionKey);
    if (existing) {
      existing.value     = body.value;
      existing.reason    = body.reason!.trim();
      existing.createdBy = store.currentUser.id;
      existing.createdOn = new Date().toISOString();
      return ok(existing);
    }
    const entry = {
      id:            genId("upo"),
      userId:        params.userId,
      permissionKey: body.permissionKey,
      value:         body.value,
      reason:        body.reason!.trim(),
      createdBy:     store.currentUser.id,
      createdOn:     new Date().toISOString(),
    };
    entries.push(entry);
    // Auditoría
    (store.auditLog as unknown[]).push({
      id: genId("audit"), category: "OVERRIDE",
      action: "PERMISSION_OVERRIDE_SET",
      who: store.currentUser.id, whoRole: store.currentUser.roles[0],
      at: new Date().toISOString(),
      before: {}, after: { userId: params.userId, key: body.permissionKey, value: body.value },
      description: `Override: '${body.permissionKey}' → ${body.value} para usuario '${params.userId}'. Razón: ${body.reason}`,
    });
    return HttpResponse.json(entry, { status: 201 });
  }),

  // ── DELETE /api/users/:userId/overrides/:id ───────────
  http.delete("/api/users/:userId/overrides/:id", ({ params }) => {
    if (!currentUserHasRole(["Admin"])) return err(403, "Solo Admin");
    const entries = (store.userPermissionOverrides ?? []) as Array<Record<string, unknown>>;
    const idx = entries.findIndex((e) => e.id === params.id && e.userId === params.userId);
    if (idx === -1) return err(404, "Override no encontrado");
    const removed = entries[idx];
    entries.splice(idx, 1);
    (store.auditLog as unknown[]).push({
      id: genId("audit"), category: "OVERRIDE",
      action: "PERMISSION_OVERRIDE_REMOVED",
      who: store.currentUser.id, whoRole: store.currentUser.roles[0],
      at: new Date().toISOString(),
      before: removed as Record<string, unknown>, after: {},
      description: `Override '${removed.permissionKey}' eliminado para usuario '${params.userId}'`,
    });
    return ok({ ok: true });
  }),
];
