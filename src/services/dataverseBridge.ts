// ─────────────────────────────────────────────────────────
//  src/services/dataverseBridge.ts
//
//  Puente capa-de-servicios ↔ Dataverse.
//  Usa dataverseSdk.ts para acceso al SDK (con cola de escrituras).
//
//  Publisher prefix : cproroad_
//  Tablas creadas en : dataverse/Create-DataverseTables.ps1
//
//  Convenciones Dataverse:
//    - Lookup READ  : _cproroad_xxx_value  (GUID del registro referenciado)
//    - Lookup WRITE : cproroad_Xxx@odata.bind = "/entity(guid)"
//    - Choice READ  : campo devuelve integer
//    - Choice WRITE : campo recibe integer
// ─────────────────────────────────────────────────────────

/* eslint-disable @typescript-eslint/no-explicit-any */

import type {
  AppRole, BusinessArea, Project, WorkItem, State, Transition,
  Team, Provider, Evidence, ActivityLogEntry, Risk, Request,
  AppUser, User, SystemSettings, WipLimits, RbacPermission,
  RolePermissionsMap, AdminAuditEntry, PermissionProfile,
  ProfilePermission, UserProfile, UserPermissionOverride,
  EffectivePermissions, DeliveryOwnerType, TeamType,
  ProjectStatus, WorkItemType, Priority, EvidenceType,
  RiskSeverity, RiskStatus, SyncStatus, VisibilityMode,
  RequestType, RequestStatus,
} from "../types/domain";

import { sdkGet, sdkGetOne, sdkCreate, sdkUpdate, sdkDelete, IS_LOCAL } from "./dataverseSdk";
import { searchTenantUsersViaOffice365 } from "./office365Connector";
export { IS_LOCAL };

// ── Usuario efectivo (real o impersonado) ─────────────────────────────────
// Establecido por ImpersonationContext cuando effectiveUser cambia.
// Usado por GET /me para devolver el usuario actual a las pantallas.
let _effectiveUser: { id: string; displayName: string; email: string; role: string; teamIds?: string[]; } | null = null;

export function setBridgeEffectiveUser(user: { id: string; displayName: string; email: string; role: string; teamIds?: string[]; }): void {
  _effectiveUser = user;
}

// ── Compatibilidad: getXrm() devuelve la misma interfaz que antes ─────────
// pero internamente delega en el SDK con cola de escrituras.
// Todos los handlers de dvRequest siguen usando  const api = getXrm()
// sin necesidad de cambios.
type XrmWebApiResult<T = any> = Promise<{ entities: T[] }>;
interface XrmWebApi {
  retrieveMultipleRecords(entity: string, options?: string): XrmWebApiResult;
  retrieveRecord(entity: string, id: string, options?: string): Promise<any>;
  createRecord(entity: string, data: Record<string, any>): Promise<{ id: string }>;
  updateRecord(entity: string, id: string, data: Record<string, any>): Promise<{ id: string }>;
  deleteRecord(entity: string, id: string): Promise<{ id: string }>;
}

function getXrm(): XrmWebApi {
  return {
    retrieveMultipleRecords: sdkGet,
    retrieveRecord:          sdkGetOne,
    createRecord:            sdkCreate as XrmWebApi["createRecord"],
    updateRecord:            sdkUpdate as XrmWebApi["updateRecord"],
    deleteRecord:            sdkDelete as XrmWebApi["deleteRecord"],
  };
}

/** True cuando window.Xrm.WebApi está disponible (Power Apps / pac code run). */
export function isDvContext(): boolean {
  // Xrm explícito (Model-Driven / algunos Code Apps)
  if (typeof (window as any).Xrm !== "undefined" &&
      (window as any).Xrm?.WebApi !== undefined) {
    return true;
  }
  // Canvas Code App: corre dentro de apps.powerapps.com sin Xrm en window
  try {
    const h = window.location.hostname;
    if (h.includes("powerapps.com") || h.includes("dynamics.com")) return true;
  } catch { /* sin window */ }
  return false;
}

// ── Tabla lógica de nombres ────────────────────────────────────────────────
const E = {
  businessArea:           "cproroad_businessarea",
  team:                   "cproroad_team",
  state:                  "cproroad_state",
  transition:             "cproroad_transition",
  appUser:                "cproroad_appuser",
  project:                "cproroad_project",
  workItem:               "cproroad_workitem",
  evidence:               "cproroad_evidence",
  activityLog:            "cproroad_activitylog",
  risk:                   "cproroad_risk",
  request:                "cproroad_request",
  rolePermission:         "cproroad_rolepermission",
  rbacPermission:         "cproroad_rbacpermission",
  permissionProfile:      "cproroad_permissionprofile",
  profilePermission:      "cproroad_profilepermission",
  userProfile:            "cproroad_userprofile",
  userPermOverride:       "cproroad_userpermissionoverride",
  systemSettings:         "cproroad_systemsettings",
  wipConfig:              "cproroad_wipconfig",
} as const;

// ── $select strings ────────────────────────────────────────────────────────
const SEL = {
  businessArea: "$select=cproroad_businessareaid,cproroad_name",
  team:         "$select=cproroad_teamid,cproroad_name,cproroad_type,cproroad_isactive",
  state:        "$select=cproroad_stateid,cproroad_name,cproroad_category,cproroad_order",
  transition:   "$select=cproroad_transitionid,cproroad_name," +
                "_cproroad_fromstateid_value,_cproroad_tostateid_value," +
                "cproroad_allowedroles,cproroad_assigntorole,cproroad_autoassignteam," +
                "cproroad_requireuserassignment,cproroad_requireevidence," +
                "cproroad_evidencetypes,cproroad_requirecomment,cproroad_confirmmove",
  appUser:      "$select=cproroad_appuserid,cproroad_name,cproroad_email," +
                "cproroad_upn,cproroad_role,cproroad_isactive,cproroad_teamids",
  project:      "$select=cproroad_projectid,cproroad_name,cproroad_code," +
                "cproroad_status,cproroad_priority,cproroad_category," +
                "cproroad_startdate,cproroad_enddate,cproroad_progress," +
                "cproroad_blockedreason,cproroad_deliveryownertype,cproroad_visibilitymode," +
                "_cproroad_businessareaid_value,_cproroad_providerteamid_value," +
                "_cproroad_assignedtoteamid_value,_cproroad_assignedtouserid_value," +
                "_cproroad_requestedbyuserid_value",
  workItem:     "$select=cproroad_workitemid,cproroad_name,cproroad_type," +
                "cproroad_priority,cproroad_progress,cproroad_startdate,cproroad_enddate," +
                "cproroad_tags,cproroad_blockedreason,cproroad_jiraissuekey,cproroad_jiraurl," +
                "cproroad_jirastate,cproroad_sprintname,cproroad_syncstatus,cproroad_syncerror," +
                "_cproroad_projectid_value,_cproroad_stateid_value," +
                "_cproroad_assignedtoteamid_value,_cproroad_assignedtouserid_value," +
                "_cproroad_requestedbyuserid_value,_cproroad_createdbyuserid_value",
  evidence:     "$select=cproroad_evidenceid,cproroad_name,cproroad_entitytype," +
                "cproroad_entityid,cproroad_type,cproroad_value,cproroad_comment," +
                "_cproroad_createdbyuserid_value,createdon",
  activityLog:  "$select=cproroad_activitylogid,cproroad_name,cproroad_entitytype," +
                "cproroad_entityid,cproroad_fromvalue,cproroad_tovalue,cproroad_who," +
                "cproroad_whorole,cproroad_at,cproroad_note,_cproroad_projectid_value,createdon",
  risk:         "$select=cproroad_riskid,cproroad_name,cproroad_description," +
                "cproroad_severity,cproroad_status,cproroad_ownerrole,cproroad_duedate," +
                "cproroad_closecomment,cproroad_closedon," +
                "_cproroad_projectid_value,_cproroad_assignedtouserid_value," +
                "_cproroad_linkedworkitemid_value,_cproroad_createdbyuserid_value," +
                "_cproroad_closedbyuserid_value,createdon",
  request:      "$select=cproroad_requestid,cproroad_name,cproroad_year," +
                "cproroad_description,cproroad_type,cproroad_priority,cproroad_status," +
                "cproroad_triagenote,cproroad_cancelednote,createdon,modifiedon," +
                "_cproroad_requestedbyuserid_value,_cproroad_requestedbyteamid_value," +
                "_cproroad_relatedprojectid_value,_cproroad_triageowneruserid_value," +
                "_cproroad_convertedworkitemid_value",
  permProfile:  "$select=cproroad_permissionprofileid,cproroad_name," +
                "cproroad_label,cproroad_description,cproroad_isactive",
  profPerm:     "$select=cproroad_profilepermissionid,cproroad_name," +
                "cproroad_permissionkey,_cproroad_profileid_value",
  userProfile:  "$select=cproroad_userprofileid,cproroad_name,cproroad_assignedon," +
                "_cproroad_userid_value,_cproroad_profileid_value,_cproroad_assignedbyuserid_value",
  userOverride: "$select=cproroad_userpermissionoverrideid,cproroad_name," +
                "cproroad_permissionkey,cproroad_value,cproroad_reason,_cproroad_userid_value",
  rolePerms:    "$select=cproroad_rolepermissionid,cproroad_name," +
                "cproroad_role,cproroad_permissionkey,cproroad_value",
  rbacPerm:     "$select=cproroad_rbacpermissionid,cproroad_name,cproroad_label,cproroad_group",
  sysSettings:  "$select=cproroad_systemsettingsid,cproroad_name," +
                "cproroad_strictvalidation,cproroad_adminbypass," +
                "cproroad_closecommentrequired,cproroad_closechecklistrequired," +
                "cproroad_weekdays,cproroad_jirasyncenabled,cproroad_wiplimits",
  wipConfig:    "$select=cproroad_wipconfigid,cproroad_name,cproroad_limit," +
                "_cproroad_stateid_value",
};

// ── Mapas choice ───────────────────────────────────────────────────────────
function inv<V extends string>(m: Record<number, V>): Record<string, number> {
  return Object.fromEntries(Object.entries(m).map(([k, v]) => [v, Number(k)]));
}

const ROLE_F: Record<number, AppRole> = {
  100000000: "Admin", 100000001: "IT AirEuropa",
  100000002: "Proveedor", 100000003: "Usuario", 100000004: "Invitado",
};
const ROLE_T = inv(ROLE_F) as Record<AppRole, number>;

const PRI_F: Record<number, Priority> = {
  100000000: "Alta", 100000001: "Media", 100000002: "Baja",
};
const PRI_T = inv(PRI_F) as Record<Priority, number>;

const PRJST_F: Record<number, ProjectStatus> = {
  100000000: "Pendiente", 100000001: "En curso",
  100000002: "Bloqueado", 100000003: "Cerrado",
};
const PRJST_T = inv(PRJST_F) as Record<ProjectStatus, number>;

const WITYPE_F: Record<number, WorkItemType> = {
  100000000: "Feature", 100000001: "Bug",
  100000002: "TechDebt", 100000003: "Spike",
};
const WITYPE_T = inv(WITYPE_F) as Record<WorkItemType, number>;

const TTYPE_F: Record<number, TeamType> = {
  100000000: "Area", 100000001: "Provider", 100000002: "Internal",
};

const DLVOWN_F: Record<number, DeliveryOwnerType> = {
  100000000: "IT", 100000001: "Proveedor",
};
const DLVOWN_T = inv(DLVOWN_F) as Record<DeliveryOwnerType, number>;

const VIS_F: Record<number, VisibilityMode> = {
  100000000: "Enterprise", 100000001: "Restricted",
};
const VIS_T = inv(VIS_F) as Record<VisibilityMode, number>;

const SYNC_F: Record<number, SyncStatus> = {
  100000000: "OK", 100000001: "Pending", 100000002: "Error",
};

const EVTYPE_F: Record<number, EvidenceType> = {
  100000000: "link", 100000001: "comment", 100000002: "file",
};
const EVTYPE_T = inv(EVTYPE_F) as Record<EvidenceType, number>;

const REQTYPE_F: Record<number, RequestType> = {
  100000000: "Bug", 100000001: "Mejora", 100000002: "Feature",
  100000003: "Incidencia", 100000004: "Consulta",
  100000005: "CambioNormativo", 100000006: "Impedimento",
};
const REQTYPE_T = inv(REQTYPE_F) as Record<RequestType, number>;

const REQST_F: Record<number, RequestStatus> = {
  100000000: "Nuevo", 100000001: "En revisión", 100000002: "Info requerida",
  100000003: "Aprobada", 100000004: "Rechazada",
  100000005: "Convertida", 100000006: "Cancelada",
};
const REQST_T = inv(REQST_F) as Record<RequestStatus, number>;

const RSKST_F: Record<number, RiskStatus> = {
  100000000: "Abierto", 100000001: "En mitigación", 100000002: "Resuelto",
};
const RSKST_T = inv(RSKST_F) as Record<RiskStatus, number>;

const RBACGRP_F: Record<number, string> = {
  100000000: "TAREAS", 100000001: "TRANSICIONES", 100000002: "VISTAS",
};

// ── Cache de AppUsers (para derivar roles por lookup) ─────────────────────
let _userCache: AppUser[] | null = null;
let _userMap: Map<string, AppUser> | null = null;

async function loadUsers(): Promise<Map<string, AppUser>> {
  if (_userMap) return _userMap;
  const r = await getXrm().retrieveMultipleRecords(E.appUser, `?${SEL.appUser}`);
  _userCache = r.entities.map(dvToAppUser);
  _userMap = new Map(_userCache.map(u => [u.id, u]));
  return _userMap;
}

function invalidateUserCache() { _userCache = null; _userMap = null; }

// ── Helpers ────────────────────────────────────────────────────────────────
function safeJson<T>(v: string | null | undefined, fallback: T): T {
  if (!v) return fallback;
  try { return JSON.parse(v) as T; } catch { return fallback; }
}

// Parsea un campo JSON que puede ser un array ["a","b"] o un escalar "a"
// (PowerShell serializa arrays de un elemento como escalar, no como array)
function safeJsonArr(v: string | null | undefined): string[] {
  if (!v) return [];
  try {
    const parsed = JSON.parse(v);
    if (Array.isArray(parsed)) return parsed as string[];
    if (parsed != null && parsed !== "") return [String(parsed)];
    return [];
  } catch { return []; }
}

function id(r: any, col: string): string {
  return (r[col] ?? "") as string;
}

function lookup(r: any, col: string): string | null {
  const v = r[`_${col}_value`];
  return (v != null && v !== "") ? String(v) : null;
}

function choice<T>(r: any, col: string, map: Record<number, T>, fallback: T): T {
  const v = r[col];
  return (v != null ? (map[v as number] ?? fallback) : fallback);
}

// ── Enlace OData para lookup en escritura ─────────────────────────────────
function bind(entity: string, guid: string | null | undefined): string | null {
  if (!guid) return null;
  return `/${entity}(${guid})`;
}

// ── Entity mappers: Dataverse → dominio ────────────────────────────────────
function dvToBusinessArea(r: any): BusinessArea {
  return { id: id(r, "cproroad_businessareaid"), name: r.cproroad_name };
}

function dvToTeam(r: any): Team {
  return {
    id: id(r, "cproroad_teamid"),
    name: r.cproroad_name,
    type: choice(r, "cproroad_type", TTYPE_F, "Internal"),
    isActive: r.cproroad_isactive ?? true,
  };
}

function dvToState(r: any): State {
  return {
    id: id(r, "cproroad_stateid"),
    name: r.cproroad_name,
    category: r.cproroad_category ?? "",
    order: r.cproroad_order ?? 0,
  };
}

function dvToTransition(r: any): Transition {
  return {
    id: id(r, "cproroad_transitionid"),
    fromStateId: lookup(r, "cproroad_fromstateid") ?? "",
    toStateId:   lookup(r, "cproroad_tostateid") ?? "",
    allowedRoles:          safeJsonArr(r.cproroad_allowedroles) as AppRole[],
    assignToRole:          safeJsonArr(r.cproroad_assigntorole) as AppRole[],
    autoAssignTeam:        r.cproroad_autoassignteam ?? false,
    requireUserAssignment: r.cproroad_requireuserassignment ?? false,
    requireEvidence:       r.cproroad_requireevidence ?? false,
    evidenceTypes:         safeJsonArr(r.cproroad_evidencetypes) as EvidenceType[],
    requireComment:        r.cproroad_requirecomment ?? false,
    confirmMove:           r.cproroad_confirmmove ?? false,
  };
}

function dvToAppUser(r: any): AppUser {
  return {
    id: id(r, "cproroad_appuserid"),
    displayName: r.cproroad_name ?? "",
    email:    r.cproroad_email ?? "",
    upn:      r.cproroad_upn ?? "",
    role:     choice(r, "cproroad_role", ROLE_F, "Invitado"),
    teamIds:  safeJsonArr(r.cproroad_teamids) as string[],
    isActive: r.cproroad_isactive ?? true,
  };
}

function dvToProject(r: any, userMap: Map<string, AppUser>): Project {
  const uid = lookup(r, "cproroad_assignedtouserid");
  const role = uid ? (userMap.get(uid)?.role ?? "IT AirEuropa") : "IT AirEuropa";
  return {
    id: id(r, "cproroad_projectid"),
    code: r.cproroad_code ?? "",
    name: r.cproroad_name ?? "",
    businessAreaId:   lookup(r, "cproroad_businessareaid") ?? "",
    deliveryOwnerType: choice(r, "cproroad_deliveryownertype", DLVOWN_F, "IT"),
    providerId:        lookup(r, "cproroad_providerteamid") ?? "",
    providerTeamId:    lookup(r, "cproroad_providerteamid"),
    status:   choice(r, "cproroad_status",   PRJST_F, "Pendiente"),
    category: r.cproroad_category ?? "",
    priority: choice(r, "cproroad_priority", PRI_F, "Media"),
    startDate: r.cproroad_startdate ?? "",
    endDate:   r.cproroad_enddate   ?? "",
    progress:  r.cproroad_progress  ?? 0,
    blockedReason:  r.cproroad_blockedreason ?? undefined,
    assignedToRole: role,
    assignedToTeamId: lookup(r, "cproroad_assignedtoteamid"),
    assignedToUserId: uid,
    requestedByUserId: lookup(r, "cproroad_requestedbyuserid") ?? undefined,
    visibilityMode: choice(r, "cproroad_visibilitymode", VIS_F, "Enterprise"),
  };
}

function projectToDv(p: Partial<Project>): Record<string, any> {
  const dv: Record<string, any> = {};
  if (p.name !== undefined)             dv.cproroad_name = p.name;
  if (p.code !== undefined)             dv.cproroad_code = p.code;
  if (p.status !== undefined)           dv.cproroad_status = PRJST_T[p.status];
  if (p.priority !== undefined)         dv.cproroad_priority = PRI_T[p.priority];
  if (p.category !== undefined)         dv.cproroad_category = p.category;
  if (p.startDate !== undefined)        dv.cproroad_startdate = p.startDate;
  if (p.endDate !== undefined)          dv.cproroad_enddate = p.endDate;
  if (p.progress !== undefined)         dv.cproroad_progress = p.progress;
  if (p.blockedReason !== undefined)    dv.cproroad_blockedreason = p.blockedReason;
  if (p.deliveryOwnerType !== undefined) dv.cproroad_deliveryownertype = DLVOWN_T[p.deliveryOwnerType];
  if (p.visibilityMode !== undefined)   dv.cproroad_visibilitymode = VIS_T[p.visibilityMode];
  if (p.businessAreaId)
    dv[`cproroad_businessareaid@odata.bind`] = bind(E.businessArea + "s", p.businessAreaId);
  if (p.providerTeamId !== undefined)
    dv[`cproroad_providerteamid@odata.bind`] = bind(E.team + "s", p.providerTeamId);
  if (p.assignedToTeamId !== undefined)
    dv[`cproroad_assignedtoteamid@odata.bind`] = bind(E.team + "s", p.assignedToTeamId);
  if (p.assignedToUserId !== undefined)
    dv[`cproroad_assignedtouserid@odata.bind`] = bind(E.appUser + "s", p.assignedToUserId);
  if (p.requestedByUserId !== undefined)
    dv[`cproroad_requestedbyuserid@odata.bind`] = bind(E.appUser + "s", p.requestedByUserId);
  return dv;
}

function dvToWorkItem(r: any, userMap: Map<string, AppUser>): WorkItem {
  const uid  = lookup(r, "cproroad_assignedtouserid") ?? "";
  const ruid = lookup(r, "cproroad_requestedbyuserid");
  return {
    id:        id(r, "cproroad_workitemid"),
    projectId: lookup(r, "cproroad_projectid") ?? "",
    title:     r.cproroad_name ?? "",
    type:     choice(r, "cproroad_type",     WITYPE_F, "Feature"),
    priority: choice(r, "cproroad_priority", PRI_F,    "Media"),
    stateId:  lookup(r, "cproroad_stateid") ?? "",
    requestedByRole:   ruid ? userMap.get(ruid)?.role : undefined,
    requestedByUserId: ruid ?? undefined,
    assignedToRole:    userMap.get(uid)?.role ?? "IT AirEuropa",
    assignedToTeamId:  lookup(r, "cproroad_assignedtoteamid"),
    assignedToUserId:  uid,
    startDate: r.cproroad_startdate ?? "",
    endDate:   r.cproroad_enddate   ?? "",
    progress:  r.cproroad_progress  ?? 0,
    tags:      safeJson(r.cproroad_tags, []),
    createdBy: lookup(r, "cproroad_createdbyuserid") ?? "",
    blockedReason: r.cproroad_blockedreason ?? undefined,
    jiraIssueKey:  r.cproroad_jiraissuekey ?? undefined,
    jiraUrl:       r.cproroad_jiraurl      ?? undefined,
    jiraState:     r.cproroad_jirastate    ?? undefined,
    sprintName:    r.cproroad_sprintname   ?? undefined,
    syncStatus:    choice(r, "cproroad_syncstatus", SYNC_F, "OK"),
    syncError:     r.cproroad_syncerror    ?? undefined,
  };
}

function workItemToDv(wi: Partial<WorkItem & { description?: string }>): Record<string, any> {
  const dv: Record<string, any> = {};
  if (wi.title     !== undefined) dv.cproroad_name      = wi.title;
  if (wi.type      !== undefined) dv.cproroad_type      = WITYPE_T[wi.type];
  if (wi.priority  !== undefined) dv.cproroad_priority  = PRI_T[wi.priority];
  if (wi.progress  !== undefined) dv.cproroad_progress  = wi.progress;
  if (wi.startDate !== undefined) dv.cproroad_startdate = wi.startDate;
  if (wi.endDate   !== undefined) dv.cproroad_enddate   = wi.endDate;
  if (wi.tags      !== undefined) dv.cproroad_tags      = JSON.stringify(wi.tags);
  if (wi.blockedReason !== undefined) dv.cproroad_blockedreason = wi.blockedReason;
  if (wi.jiraIssueKey  !== undefined) dv.cproroad_jiraissuekey = wi.jiraIssueKey;
  if (wi.jiraUrl       !== undefined) dv.cproroad_jiraurl      = wi.jiraUrl;
  if (wi.jiraState     !== undefined) dv.cproroad_jirastate    = wi.jiraState;
  if (wi.sprintName    !== undefined) dv.cproroad_sprintname   = wi.sprintName;
  if (wi.projectId)
    dv[`cproroad_projectid@odata.bind`] = bind(E.project + "s", wi.projectId);
  if (wi.stateId)
    dv[`cproroad_stateid@odata.bind`] = bind(E.state + "s", wi.stateId);
  if (wi.assignedToTeamId !== undefined)
    dv[`cproroad_assignedtoteamid@odata.bind`] = bind(E.team + "s", wi.assignedToTeamId);
  if (wi.assignedToUserId)
    dv[`cproroad_assignedtouserid@odata.bind`] = bind(E.appUser + "s", wi.assignedToUserId);
  if (wi.requestedByUserId)
    dv[`cproroad_requestedbyuserid@odata.bind`] = bind(E.appUser + "s", wi.requestedByUserId);
  return dv;
}

function dvToEvidence(r: any): Evidence {
  return {
    id: id(r, "cproroad_evidenceid"),
    entityType: r.cproroad_entitytype === 100000000 ? "WorkItem" : "Project",
    entityId: r.cproroad_entityid ?? "",
    type:    choice(r, "cproroad_type", EVTYPE_F, "comment"),
    value:   r.cproroad_value   ?? "",
    comment: r.cproroad_comment ?? "",
    createdBy: lookup(r, "cproroad_createdbyuserid") ?? "",
    createdOn: r.createdon ?? "",
  };
}

function dvToActivityLog(r: any): ActivityLogEntry {
  return {
    id: id(r, "cproroad_activitylogid"),
    projectId:  lookup(r, "cproroad_projectid") ?? "",
    entityType: r.cproroad_entitytype ?? "",
    entityId:   r.cproroad_entityid   ?? "",
    action:     r.cproroad_name       ?? "",
    from:       r.cproroad_fromvalue  ?? "",
    to:         r.cproroad_tovalue    ?? "",
    who:        r.cproroad_who        ?? "",
    whoRole:    choice(r, "cproroad_whorole", ROLE_F, "Usuario"),
    at:         r.cproroad_at ?? r.createdon ?? "",
    note:       r.cproroad_note ?? undefined,
  };
}

function dvToRisk(r: any): Risk {
  return {
    id:          id(r, "cproroad_riskid"),
    projectId:   lookup(r, "cproroad_projectid") ?? "",
    title:       r.cproroad_name ?? "",
    description: r.cproroad_description ?? undefined,
    severity:    choice(r, "cproroad_severity", PRI_F, "Media") as RiskSeverity,
    status:      choice(r, "cproroad_status",   RSKST_F, "Abierto"),
    ownerRole:   choice(r, "cproroad_ownerrole", ROLE_F, "IT AirEuropa"),
    assignedToUserId: lookup(r, "cproroad_assignedtouserid") ?? undefined,
    dueDate:     r.cproroad_duedate     ?? "",
    linkedWorkItemId: lookup(r, "cproroad_linkedworkitemid") ?? "",
    createdBy:   lookup(r, "cproroad_createdbyuserid") ?? "",
    createdOn:   r.createdon ?? "",
    closedBy:    lookup(r, "cproroad_closedbyuserid") ?? undefined,
    closedOn:    r.cproroad_closedon    ?? undefined,
    closeComment: r.cproroad_closecomment ?? undefined,
  };
}

function dvToRequest(r: any, userMap: Map<string, AppUser>): Request {
  const uid = lookup(r, "cproroad_requestedbyuserid") ?? "";
  return {
    id:    id(r, "cproroad_requestid"),
    year:  r.cproroad_year ?? new Date().getFullYear(),
    title: r.cproroad_name ?? "",
    description: r.cproroad_description ?? "",
    type:     choice(r, "cproroad_type",     REQTYPE_F, "Consulta"),
    priority: choice(r, "cproroad_priority", PRI_F,     "Media"),
    requestedByUserId: uid,
    requestedByRole:   userMap.get(uid)?.role ?? "Usuario",
    requestedByTeamId: lookup(r, "cproroad_requestedbyteamid"),
    relatedProjectId:  lookup(r, "cproroad_relatedprojectid"),
    status:            choice(r, "cproroad_status", REQST_F, "Nuevo"),
    triageOwnerUserId: lookup(r, "cproroad_triageowneruserid"),
    triageNote:        r.cproroad_triagenote  ?? null,
    createdOn:         r.createdon   ?? "",
    updatedOn:         r.modifiedon  ?? "",
    convertedWorkItemId: lookup(r, "cproroad_convertedworkitemid"),
    cancelledNote:     r.cproroad_cancelednote ?? null,
  };
}

function dvToPermProfile(r: any): PermissionProfile {
  return {
    id:          id(r, "cproroad_permissionprofileid"),
    name:        r.cproroad_name  ?? "",
    label:       r.cproroad_label ?? "",
    description: r.cproroad_description ?? undefined,
    isActive:    r.cproroad_isactive ?? true,
  };
}

function dvToProfPerm(r: any): ProfilePermission {
  return {
    id:            id(r, "cproroad_profilepermissionid"),
    profileId:     lookup(r, "cproroad_profileid") ?? "",
    permissionKey: r.cproroad_permissionkey ?? "",
  };
}

function dvToUserProfile(r: any): UserProfile {
  return {
    id:             id(r, "cproroad_userprofileid"),
    userId:         lookup(r, "cproroad_userid") ?? "",
    profileId:      lookup(r, "cproroad_profileid") ?? "",
    assignedByUserId: lookup(r, "cproroad_assignedbyuserid") ?? "",
    assignedOn:     r.cproroad_assignedon ?? r.createdon ?? "",
  };
}

function dvToUserOverride(r: any): UserPermissionOverride {
  return {
    id:            id(r, "cproroad_userpermissionoverrideid"),
    userId:        lookup(r, "cproroad_userid") ?? "",
    permissionKey: r.cproroad_permissionkey ?? "",
    value:         r.cproroad_value ?? false,
    reason:        r.cproroad_reason ?? "",
  };
}

// ── Operaciones complejas ──────────────────────────────────────────────────

/** Calcula los permisos efectivos del usuario combinando rol + perfiles + overrides. */
async function computeEffectivePermissions(userId: string): Promise<EffectivePermissions> {
  const api = getXrm();
  const userMap = await loadUsers();
  const user = userMap.get(userId);
  if (!user) throw new Error(`Usuario no encontrado: ${userId}`);

  // 1. Permisos base del rol (rolepermission)
  const rolePermsR = await api.retrieveMultipleRecords(
    E.rolePermission,
    `?${SEL.rolePerms}&$filter=cproroad_role eq ${ROLE_T[user.role]}`,
  );
  const base: Record<string, boolean> = {};
  rolePermsR.entities.forEach(r => {
    base[r.cproroad_permissionkey as string] = r.cproroad_value ?? false;
  });

  // 2. Perfiles asignados al usuario
  const userProfilesR = await api.retrieveMultipleRecords(
    E.userProfile,
    `?${SEL.userProfile}&$filter=_cproroad_userid_value eq '${userId}'`,
  );
  const profileIds = userProfilesR.entities.map(r => lookup(r, "cproroad_profileid")).filter(Boolean) as string[];

  // 3. Permisos de los perfiles (additive)
  const profilePerms: Record<string, boolean> = {};
  if (profileIds.length > 0) {
    for (const pid of profileIds) {
      const ppR = await api.retrieveMultipleRecords(
        E.profilePermission,
        `?${SEL.profPerm}&$filter=_cproroad_profileid_value eq '${pid}'`,
      );
      ppR.entities.forEach(r => {
        profilePerms[r.cproroad_permissionkey as string] = true;
      });
    }
  }

  // 4. Overrides de usuario
  const overridesR = await api.retrieveMultipleRecords(
    E.userPermOverride,
    `?${SEL.userOverride}&$filter=_cproroad_userid_value eq '${userId}'`,
  );
  const overrides: Record<string, boolean> = {};
  overridesR.entities.forEach(r => {
    overrides[r.cproroad_permissionkey as string] = r.cproroad_value ?? false;
  });

  // Merge: base + profilePerms (additive) + overrides (final)
  const merged: Record<string, boolean> = { ...base };
  Object.entries(profilePerms).forEach(([k, v]) => {
    if (v) merged[k] = true; // perfiles solo pueden añadir
  });
  Object.entries(overrides).forEach(([k, v]) => {
    merged[k] = v; // overrides tienen prioridad absoluta
  });

  return {
    userId,
    role: user.role,
    permissions: merged,
    profileIds,
    overrides,
  };
}

/** Registra una entrada en el log de actividad. */
async function logActivity(entry: {
  projectId?: string;
  entityType: string;
  entityId: string;
  action: string;
  from?: string;
  to?: string;
  who: string;
  whoRole: AppRole;
  note?: string;
}) {
  const dv: Record<string, any> = {
    cproroad_name:       entry.action,
    cproroad_entitytype: entry.entityType,
    cproroad_entityid:   entry.entityId,
    cproroad_fromvalue:  entry.from ?? "",
    cproroad_tovalue:    entry.to   ?? "",
    cproroad_who:        entry.who,
    cproroad_whorole:    ROLE_T[entry.whoRole],
    cproroad_at:         new Date().toISOString(),
    cproroad_note:       entry.note ?? "",
  };
  if (entry.projectId)
    dv[`cproroad_projectid@odata.bind`] = bind(E.project + "s", entry.projectId);
  await getXrm().createRecord(E.activityLog, dv).catch(() => { /* best-effort */ });
}

// ── Enrutador principal ────────────────────────────────────────────────────
// Imita la firma de apiClient.request para que apiClient.ts pueda delegarle.

type Method = "GET" | "POST" | "PATCH" | "DELETE";

function match(path: string, pattern: string): Record<string, string> | null {
  const keys: string[] = [];
  const re = new RegExp(
    "^" + pattern.replace(/:([^/]+)/g, (_, k) => { keys.push(k); return "([^/]+)"; }) + "$",
  );
  const m = path.match(re);
  if (!m) return null;
  return Object.fromEntries(keys.map((k, i) => [k, m[i + 1]]));
}

export async function dvRequest<T>(
  method: Method,
  path: string,
  body?: unknown,
): Promise<T> {
  const api    = getXrm();
  const [base, qs] = path.split("?");
  const qp     = new URLSearchParams(qs ?? "");
  let   params : Record<string, string> | null;

  // ════════════════════════════════════════════════════════
  //  CURRENT USER (/me)
  // ════════════════════════════════════════════════════════
  if (method === "GET" && match(base, "/me")) {
    if (!_effectiveUser) {
      throw new Error("[dataverseBridge] GET /me: usuario no inicializado — setBridgeEffectiveUser no fue llamado");
    }
    return {
      id:          _effectiveUser.id,
      displayName: _effectiveUser.displayName,
      email:       _effectiveUser.email,
      roles:       [_effectiveUser.role as AppRole],
    } as unknown as T;
  }

  // ════════════════════════════════════════════════════════
  //  BUSINESS AREAS
  // ════════════════════════════════════════════════════════
  if (method === "GET" && match(base, "/business-areas")) {
    const r = await api.retrieveMultipleRecords(E.businessArea, `?${SEL.businessArea}`);
    return r.entities.map(dvToBusinessArea) as unknown as T;
  }

  // ════════════════════════════════════════════════════════
  //  TEAMS / PROVIDERS
  // ════════════════════════════════════════════════════════
  if (method === "GET" && (match(base, "/admin/providers") || match(base, "/providers"))) {
    const r = await api.retrieveMultipleRecords(
      E.team, `?${SEL.team}&$filter=cproroad_type eq ${100000001}`,
    );
    return r.entities.map((t): Provider => ({
      id: id(t, "cproroad_teamid"),
      name: t.cproroad_name ?? "",
      isActive: t.cproroad_isactive ?? true,
      contactEmail: "",
    })) as unknown as T;
  }

  if (method === "POST" && match(base, "/admin/providers")) {
    const b = body as { name: string; isActive: boolean };
    const dv: Record<string, any> = {
      cproroad_name:     b.name,
      cproroad_type:     100000001,
      cproroad_isactive: b.isActive ?? true,
    };
    const created = await api.createRecord(E.team, dv);
    const r = await api.retrieveRecord(E.team, created.id, `?${SEL.team}`);
    return { id: id(r, "cproroad_teamid"), name: r.cproroad_name ?? "", isActive: r.cproroad_isactive ?? true } as unknown as T;
  }

  if (method === "PATCH" && (params = match(base, "/admin/providers/:id"))) {
    const b = body as { name?: string; isActive?: boolean };
    const dv: Record<string, any> = {};
    if (b.name !== undefined)     dv.cproroad_name     = b.name;
    if (b.isActive !== undefined) dv.cproroad_isactive = b.isActive;
    await api.updateRecord(E.team, params.id, dv);
    const r = await api.retrieveRecord(E.team, params.id, `?${SEL.team}`);
    return { id: id(r, "cproroad_teamid"), name: r.cproroad_name ?? "", isActive: r.cproroad_isactive ?? true } as unknown as T;
  }

  if (method === "GET" && match(base, "/teams")) {
    let filter = "";
    const filters: string[] = [];
    if (qp.get("type")) filters.push(`cproroad_type eq ${TTYPE_F[qp.get("type") as keyof typeof TTYPE_F] ?? 0}`);
    if (qp.get("isActive") !== null && qp.get("isActive") !== "")
      filters.push(`cproroad_isactive eq ${qp.get("isActive") === "true"}`);
    if (filters.length) filter = `&$filter=${filters.join(" and ")}`;
    const r = await api.retrieveMultipleRecords(E.team, `?${SEL.team}${filter}`);
    return r.entities.map(dvToTeam) as unknown as T;
  }

  if (method === "GET" && (params = match(base, "/teams/:id"))) {
    const r = await api.retrieveRecord(E.team, params.id, `?${SEL.team}`);
    return dvToTeam(r) as unknown as T;
  }

  if (method === "POST" && match(base, "/teams")) {
    const b = body as { name: string; type: TeamType; isActive?: boolean };
    const dv: Record<string, any> = {
      cproroad_name: b.name,
      cproroad_type: Object.entries(TTYPE_F).find(([, v]) => v === b.type)?.[0] ?? 100000002,
      cproroad_isactive: b.isActive ?? true,
    };
    const created = await api.createRecord(E.team, dv);
    const r = await api.retrieveRecord(E.team, created.id, `?${SEL.team}`);
    return dvToTeam(r) as unknown as T;
  }

  if (method === "PATCH" && (params = match(base, "/teams/:id"))) {
    const b = body as { name?: string; type?: TeamType; isActive?: boolean };
    const dv: Record<string, any> = {};
    if (b.name !== undefined)     dv.cproroad_name     = b.name;
    if (b.type !== undefined)     dv.cproroad_type     = Object.entries(TTYPE_F).find(([, v]) => v === b.type)?.[0] ?? 100000002;
    if (b.isActive !== undefined) dv.cproroad_isactive = b.isActive;
    await api.updateRecord(E.team, params.id, dv);
    const r = await api.retrieveRecord(E.team, params.id, `?${SEL.team}`);
    return dvToTeam(r) as unknown as T;
  }

  if (method === "DELETE" && (params = match(base, "/teams/:id"))) {
    await api.deleteRecord(E.team, params.id);
    return undefined as unknown as T;
  }

  // ════════════════════════════════════════════════════════
  //  STATES / TRANSITIONS
  // ════════════════════════════════════════════════════════
  if (method === "GET" && match(base, "/states")) {
    const r = await api.retrieveMultipleRecords(
      E.state, `?${SEL.state}&$orderby=cproroad_order asc`,
    );
    return r.entities.map(dvToState) as unknown as T;
  }

  if (method === "GET" && match(base, "/transitions")) {
    const r = await api.retrieveMultipleRecords(E.transition, `?${SEL.transition}`);
    return r.entities.map(dvToTransition) as unknown as T;
  }

  if (method === "POST" && match(base, "/transitions")) {
    const b = body as Partial<Transition>;
    const dv: Record<string, any> = {
      cproroad_name:                b.fromStateId ?? "transition",
      cproroad_allowedroles:        JSON.stringify(b.allowedRoles ?? []),
      cproroad_assigntorole:        JSON.stringify(b.assignToRole ?? []),
      cproroad_autoassignteam:      b.autoAssignTeam ?? false,
      cproroad_requireuserassignment: b.requireUserAssignment ?? false,
      cproroad_requireevidence:     b.requireEvidence ?? false,
      cproroad_evidencetypes:       JSON.stringify(b.evidenceTypes ?? []),
      cproroad_requirecomment:      b.requireComment ?? false,
      cproroad_confirmmove:         b.confirmMove ?? false,
    };
    if (b.fromStateId) dv[`cproroad_fromstateid@odata.bind`] = bind(E.state + "s", b.fromStateId);
    if (b.toStateId)   dv[`cproroad_tostateid@odata.bind`]   = bind(E.state + "s", b.toStateId);
    const created = await api.createRecord(E.transition, dv);
    const r = await api.retrieveRecord(E.transition, created.id, `?${SEL.transition}`);
    return dvToTransition(r) as unknown as T;
  }

  if (method === "DELETE" && (params = match(base, "/transitions/:id"))) {
    await api.deleteRecord(E.transition, params.id);
    return undefined as unknown as T;
  }

  if (method === "PATCH" && (params = match(base, "/transitions/:id"))) {
    const b = body as Partial<Transition>;
    const dv: Record<string, any> = {};
    if (b.allowedRoles !== undefined)         dv.cproroad_allowedroles           = JSON.stringify(b.allowedRoles);
    if (b.assignToRole !== undefined)         dv.cproroad_assigntorole           = JSON.stringify(b.assignToRole);
    if (b.autoAssignTeam !== undefined)       dv.cproroad_autoassignteam         = b.autoAssignTeam;
    if (b.requireUserAssignment !== undefined) dv.cproroad_requireuserassignment = b.requireUserAssignment;
    if (b.requireEvidence !== undefined)      dv.cproroad_requireevidence        = b.requireEvidence;
    if (b.evidenceTypes !== undefined)        dv.cproroad_evidencetypes          = JSON.stringify(b.evidenceTypes);
    if (b.requireComment !== undefined)       dv.cproroad_requirecomment         = b.requireComment;
    if (b.confirmMove !== undefined)          dv.cproroad_confirmmove            = b.confirmMove;
    if (b.fromStateId) dv[`cproroad_fromstateid@odata.bind`] = bind(E.state + "s", b.fromStateId);
    if (b.toStateId)   dv[`cproroad_tostateid@odata.bind`]   = bind(E.state + "s", b.toStateId);
    await api.updateRecord(E.transition, params.id, dv);
    const r = await api.retrieveRecord(E.transition, params.id, `?${SEL.transition}`);
    return dvToTransition(r) as unknown as T;
  }

  if (method === "POST" && match(base, "/transitions/reset-defaults")) {
    // 1. Obtener mapa nombre→GUID de estados
    const sr = await api.retrieveMultipleRecords(E.state, `?${SEL.state}`);
    const stateByName = new Map<string, string>(
      sr.entities.map((s: any) => [s.cproroad_name as string, id(s, "cproroad_stateid")]),
    );
    // 2. Borrar todas las transiciones actuales
    const existingTr = await api.retrieveMultipleRecords(E.transition, "?$select=cproroad_transitionid");
    await Promise.all(existingTr.entities.map((t: any) =>
      api.deleteRecord(E.transition, id(t, "cproroad_transitionid")),
    ));
    // 3. Recrear las transiciones por defecto
    const defaults = [
      { from: "Nuevo",              to: "Refinamiento",       allowed: ["Admin", "IT AirEuropa"],              assign: ["IT AirEuropa"], autoTeam: true,  reqUser: false, reqEvid: false, evTypes: [],                           reqComment: false, confirm: false },
      { from: "Refinamiento",       to: "En curso",           allowed: ["Admin", "IT AirEuropa"],              assign: ["Proveedor"],    autoTeam: true,  reqUser: true,  reqEvid: false, evTypes: [],                           reqComment: false, confirm: false },
      { from: "En curso",           to: "Listo para pruebas", allowed: ["Admin", "Proveedor"],                 assign: ["IT AirEuropa"], autoTeam: true,  reqUser: true,  reqEvid: true,  evTypes: ["link", "comment", "file"],  reqComment: false, confirm: false },
      { from: "Listo para pruebas", to: "En pruebas",         allowed: ["Admin", "IT AirEuropa"],              assign: ["Usuario"],      autoTeam: true,  reqUser: true,  reqEvid: false, evTypes: [],                           reqComment: false, confirm: false },
      { from: "En pruebas",         to: "Aceptado",           allowed: ["Admin", "IT AirEuropa", "Usuario"],   assign: ["IT AirEuropa"], autoTeam: true,  reqUser: false, reqEvid: true,  evTypes: ["comment"],                   reqComment: false, confirm: false },
      { from: "Aceptado",           to: "Cerrado",            allowed: ["Admin", "IT AirEuropa"],              assign: ["IT AirEuropa"], autoTeam: true,  reqUser: false, reqEvid: false, evTypes: [],                           reqComment: true,  confirm: true  },
      { from: "En curso",           to: "Bloqueado",          allowed: ["Admin", "IT AirEuropa", "Proveedor"], assign: ["IT AirEuropa"], autoTeam: true,  reqUser: false, reqEvid: false, evTypes: [],                           reqComment: true,  confirm: false },
      { from: "Bloqueado",          to: "En curso",           allowed: ["Admin", "IT AirEuropa"],              assign: ["Proveedor"],    autoTeam: true,  reqUser: true,  reqEvid: false, evTypes: [],                           reqComment: false, confirm: false },
    ];
    const created: Transition[] = [];
    for (const d of defaults) {
      const fromId = stateByName.get(d.from);
      const toId   = stateByName.get(d.to);
      if (!fromId || !toId) continue;
      const dv: Record<string, any> = {
        cproroad_name:                   `${d.from} -> ${d.to}`,
        cproroad_allowedroles:           JSON.stringify(d.allowed),
        cproroad_assigntorole:           JSON.stringify(d.assign),
        cproroad_autoassignteam:         d.autoTeam,
        cproroad_requireuserassignment:  d.reqUser,
        cproroad_requireevidence:        d.reqEvid,
        cproroad_evidencetypes:          JSON.stringify(d.evTypes),
        cproroad_requirecomment:         d.reqComment,
        cproroad_confirmmove:            d.confirm,
        [`cproroad_fromstateid@odata.bind`]: bind(E.state + "s", fromId),
        [`cproroad_tostateid@odata.bind`]:   bind(E.state + "s", toId),
      };
      const c = await api.createRecord(E.transition, dv);
      const r = await api.retrieveRecord(E.transition, c.id, `?${SEL.transition}`);
      created.push(dvToTransition(r));
    }
    return created as unknown as T;
  }

  // ════════════════════════════════════════════════════════
  //  USERS (simple → workitem people-picker)
  // ════════════════════════════════════════════════════════
  if (method === "GET" && match(base, "/users")) {
    const r = await api.retrieveMultipleRecords(
      E.appUser,
      `?${SEL.appUser}&$filter=cproroad_isactive eq true`,
    );
    return r.entities.map((u): User => ({
      id: id(u, "cproroad_appuserid"),
      displayName: u.cproroad_name ?? "",
      email: u.cproroad_email ?? "",
      roles: [choice(u, "cproroad_role", ROLE_F, "Invitado")],
    })) as unknown as T;
  }

  // ════════════════════════════════════════════════════════
  //  APP-USERS (userService.ts)
  // ════════════════════════════════════════════════════════
  if (method === "GET" && match(base, "/app-users")) {
    const filters: string[] = [];
    if (qp.get("isActive") !== null && qp.get("isActive") !== "")
      filters.push(`cproroad_isactive eq ${qp.get("isActive") === "true"}`);
    if (qp.get("role")) {
      const roleVal = ROLE_T[qp.get("role") as AppRole];
      if (roleVal !== undefined) filters.push(`cproroad_role eq ${roleVal}`);
    }
    const filter = filters.length ? `&$filter=${filters.join(" and ")}` : "";
    const r = await api.retrieveMultipleRecords(E.appUser, `?${SEL.appUser}${filter}`);
    let users = r.entities.map(dvToAppUser);
    const teamId = qp.get("teamId");
    if (teamId) users = users.filter((u) => u.teamIds.includes(teamId));
    const q = qp.get("query")?.toLowerCase();
    if (q) users = users.filter(u =>
      u.displayName.toLowerCase().includes(q) || u.email.toLowerCase().includes(q),
    );
    return users as unknown as T;
  }

  if (method === "GET" && (params = match(base, "/app-users/:id"))) {
    const r = await api.retrieveRecord(E.appUser, params.id, `?${SEL.appUser}`);
    return dvToAppUser(r) as unknown as T;
  }

  if (method === "POST" && match(base, "/app-users")) {
    const b = body as { displayName: string; email: string; upn: string; role: AppRole; teamIds: string[] };
    const dv: Record<string, any> = {
      cproroad_name:     b.displayName,
      cproroad_email:    b.email,
      cproroad_upn:      b.upn,
      cproroad_role:     ROLE_T[b.role],
      cproroad_isactive: true,
      cproroad_teamids:  JSON.stringify(b.teamIds ?? []),
    };
    const created = await api.createRecord(E.appUser, dv);
    invalidateUserCache();
    const r = await api.retrieveRecord(E.appUser, created.id, `?${SEL.appUser}`);
    return dvToAppUser(r) as unknown as T;
  }

  if (method === "PATCH" && (params = match(base, "/app-users/:id"))) {
    const b = body as { role?: AppRole; isActive?: boolean; teamIds?: string[] };
    const dv: Record<string, any> = {};
    if (b.role !== undefined)     dv.cproroad_role     = ROLE_T[b.role];
    if (b.isActive !== undefined) dv.cproroad_isactive = b.isActive;
    if (b.teamIds !== undefined)  dv.cproroad_teamids  = JSON.stringify(b.teamIds);
    await api.updateRecord(E.appUser, params.id, dv);
    invalidateUserCache();
    const r = await api.retrieveRecord(E.appUser, params.id, `?${SEL.appUser}`);
    return dvToAppUser(r) as unknown as T;
  }

  if (method === "POST" && (params = match(base, "/app-users/:id/activate"))) {
    await api.updateRecord(E.appUser, params.id, { cproroad_isactive: true });
    invalidateUserCache();
    const r = await api.retrieveRecord(E.appUser, params.id, `?${SEL.appUser}`);
    return dvToAppUser(r) as unknown as T;
  }

  if (method === "POST" && (params = match(base, "/app-users/:id/deactivate"))) {
    await api.updateRecord(E.appUser, params.id, { cproroad_isactive: false });
    invalidateUserCache();
    const r = await api.retrieveRecord(E.appUser, params.id, `?${SEL.appUser}`);
    return dvToAppUser(r) as unknown as T;
  }

  // ════════════════════════════════════════════════════════
  //  ADMIN USERS (userManagementService.ts)
  // ════════════════════════════════════════════════════════
  if (method === "GET" && match(base, "/admin/users")) {
    const filters: string[] = [];
    if (qp.get("status") === "active")   filters.push("cproroad_isactive eq true");
    if (qp.get("status") === "inactive") filters.push("cproroad_isactive eq false");
    if (qp.get("role")) {
      const rv = ROLE_T[qp.get("role") as AppRole];
      if (rv !== undefined) filters.push(`cproroad_role eq ${rv}`);
    }
    const filter = filters.length ? `&$filter=${filters.join(" and ")}` : "";
    const [r, upR] = await Promise.all([
      api.retrieveMultipleRecords(E.appUser, `?${SEL.appUser}${filter}`),
      api.retrieveMultipleRecords(E.userProfile,
        "?$select=_cproroad_userid_value,_cproroad_profileid_value"),
    ]);
    // Agrupar profileIds por userId
    const profilesByUser = new Map<string, string[]>();
    upR.entities.forEach((up: any) => {
      const uid = lookup(up, "cproroad_userid");
      const pid = lookup(up, "cproroad_profileid");
      if (uid && pid) {
        if (!profilesByUser.has(uid)) profilesByUser.set(uid, []);
        profilesByUser.get(uid)!.push(pid);
      }
    });
    let users = r.entities.map(dvToAppUser).map(u => ({
      ...u,
      profileIds: profilesByUser.get(u.id) ?? [],
    }));
    const q = qp.get("query")?.toLowerCase();
    if (q) users = users.filter(u =>
      u.displayName.toLowerCase().includes(q) || u.email.toLowerCase().includes(q),
    );
    return users as unknown as T;
  }

  if (method === "POST" && match(base, "/admin/users")) {
    return dvRequest<T>("POST", "/app-users", body);
  }

  if (method === "PATCH" && (params = match(base, "/admin/users/:id"))) {
    return dvRequest<T>("PATCH", `/app-users/${params.id}`, body);
  }

  if (method === "POST" && (params = match(base, "/admin/users/:id/activate"))) {
    return dvRequest<T>("POST", `/app-users/${params.id}/activate`, body);
  }

  if (method === "POST" && (params = match(base, "/admin/users/:id/deactivate"))) {
    return dvRequest<T>("POST", `/app-users/${params.id}/deactivate`, body);
  }

  // ════════════════════════════════════════════════════════
  //  PROJECTS
  // ════════════════════════════════════════════════════════
  if (method === "GET" && match(base, "/projects")) {
    const userMap = await loadUsers();
    const filters: string[] = [];
    if (qp.get("areaId"))    filters.push(`_cproroad_businessareaid_value eq '${qp.get("areaId")}'`);
    if (qp.get("status"))    filters.push(`cproroad_status eq ${PRJST_T[qp.get("status") as ProjectStatus] ?? 0}`);
    if (qp.get("providerId")) filters.push(`_cproroad_providerteamid_value eq '${qp.get("providerId")}'`);
    if (qp.get("deliveryOwnerType")) filters.push(`cproroad_deliveryownertype eq ${DLVOWN_T[qp.get("deliveryOwnerType") as DeliveryOwnerType] ?? 0}`);
    const filter = filters.length ? `&$filter=${filters.join(" and ")}` : "";
    const r = await api.retrieveMultipleRecords(E.project, `?${SEL.project}${filter}`);
    let projects = r.entities.map(rec => dvToProject(rec, userMap));
    const q = qp.get("query")?.toLowerCase();
    if (q) projects = projects.filter(p =>
      p.name.toLowerCase().includes(q) || p.code.toLowerCase().includes(q),
    );
    return projects as unknown as T;
  }

  if (method === "GET" && (params = match(base, "/projects/:id"))) {
    const userMap = await loadUsers();
    const r = await api.retrieveRecord(E.project, params.id, `?${SEL.project}`);
    return dvToProject(r, userMap) as unknown as T;
  }

  if (method === "POST" && match(base, "/projects")) {
    const b = body as Partial<Project>;
    const dv = projectToDv(b);
    const created = await api.createRecord(E.project, dv);
    const userMap = await loadUsers();
    const r = await api.retrieveRecord(E.project, created.id, `?${SEL.project}`);
    return dvToProject(r, userMap) as unknown as T;
  }

  if (method === "PATCH" && (params = match(base, "/projects/:id"))) {
    const dv = projectToDv(body as Partial<Project>);
    await api.updateRecord(E.project, params.id, dv);
    const userMap = await loadUsers();
    const r = await api.retrieveRecord(E.project, params.id, `?${SEL.project}`);
    return dvToProject(r, userMap) as unknown as T;
  }

  if (method === "DELETE" && (params = match(base, "/projects/:id"))) {
    await api.deleteRecord(E.project, params.id);
    return undefined as unknown as T;
  }

  // ════════════════════════════════════════════════════════
  //  WORKITEMS
  // ════════════════════════════════════════════════════════
  if (method === "GET" && (params = match(base, "/projects/:id/workitems"))) {
    const userMap = await loadUsers();
    const r = await api.retrieveMultipleRecords(
      E.workItem,
      `?${SEL.workItem}&$filter=_cproroad_projectid_value eq '${params.id}'`,
    );
    return r.entities.map(rec => dvToWorkItem(rec, userMap)) as unknown as T;
  }

  if (method === "GET" && match(base, "/workitems")) {
    const userMap = await loadUsers();
    const filters: string[] = [];
    if (qp.get("projectId")) filters.push(`_cproroad_projectid_value eq '${qp.get("projectId")}'`);
    if (qp.get("stateId"))   filters.push(`_cproroad_stateid_value eq '${qp.get("stateId")}'`);
    const filter = filters.length ? `&$filter=${filters.join(" and ")}` : "";
    const r = await api.retrieveMultipleRecords(E.workItem, `?${SEL.workItem}${filter}`);
    return r.entities.map(rec => dvToWorkItem(rec, userMap)) as unknown as T;
  }

  if (method === "GET" && (params = match(base, "/workitems/:id"))) {
    const userMap = await loadUsers();
    const r = await api.retrieveRecord(E.workItem, params.id, `?${SEL.workItem}`);
    return dvToWorkItem(r, userMap) as unknown as T;
  }

  if (method === "POST" && match(base, "/workitems")) {
    const b = body as Partial<WorkItem & { description?: string }>;
    const dv = workItemToDv(b);
    dv.cproroad_syncstatus = 100000001; // Pending
    const created = await api.createRecord(E.workItem, dv);
    const userMap = await loadUsers();
    const r = await api.retrieveRecord(E.workItem, created.id, `?${SEL.workItem}`);
    return dvToWorkItem(r, userMap) as unknown as T;
  }

  if (method === "PATCH" && (params = match(base, "/workitems/:id"))) {
    const dv = workItemToDv(body as Partial<WorkItem & { description?: string }>);
    await api.updateRecord(E.workItem, params.id, dv);
    const userMap = await loadUsers();
    const r = await api.retrieveRecord(E.workItem, params.id, `?${SEL.workItem}`);
    return dvToWorkItem(r, userMap) as unknown as T;
  }

  if (method === "DELETE" && (params = match(base, "/workitems/:id"))) {
    await api.deleteRecord(E.workItem, params.id);
    return undefined as unknown as T;
  }

  if (method === "PATCH" && (params = match(base, "/workitems/:id/state"))) {
    const b = body as { toStateId: string; evidence?: { type: EvidenceType; value: string; comment: string }; assignedToUserId?: string; assignedToTeamId?: string | null };
    const userMap = await loadUsers();
    const current = await api.retrieveRecord(E.workItem, params.id, `?${SEL.workItem}`);

    const dv: Record<string, any> = {};
    dv[`cproroad_stateid@odata.bind`] = bind(E.state + "s", b.toStateId);
    if (b.assignedToUserId) {
      dv[`cproroad_assignedtouserid@odata.bind`] = bind(E.appUser + "s", b.assignedToUserId);
    }
    if (b.assignedToTeamId !== undefined) {
      dv[`cproroad_assignedtoteamid@odata.bind`] = bind(E.team + "s", b.assignedToTeamId);
    }
    await api.updateRecord(E.workItem, params.id, dv);

    // Evidencia opcional
    if (b.evidence) {
      const evDv: Record<string, any> = {
        cproroad_name:       b.evidence.comment || b.evidence.value.slice(0, 50),
        cproroad_entitytype: 100000000, // WorkItem
        cproroad_entityid:   params.id,
        cproroad_type:       EVTYPE_T[b.evidence.type],
        cproroad_value:      b.evidence.value,
        cproroad_comment:    b.evidence.comment,
      };
      await api.createRecord(E.evidence, evDv).catch(() => { /* best-effort */ });
    }

    // Log actividad
    const fromWi = dvToWorkItem(current, userMap);
    const states = await api.retrieveMultipleRecords(E.state, `?${SEL.state}`);
    const stMap = new Map(states.entities.map(s => [id(s, "cproroad_stateid"), s.cproroad_name as string]));
    await logActivity({
      projectId: fromWi.projectId,
      entityType: "WorkItem",
      entityId: params.id,
      action: "Cambio de estado",
      from: stMap.get(fromWi.stateId) ?? fromWi.stateId,
      to:   stMap.get(b.toStateId)    ?? b.toStateId,
      who: b.assignedToUserId ?? fromWi.assignedToUserId,
      whoRole: userMap.get(b.assignedToUserId ?? fromWi.assignedToUserId)?.role ?? "IT AirEuropa",
    });

    const updated = await api.retrieveRecord(E.workItem, params.id, `?${SEL.workItem}`);
    return dvToWorkItem(updated, userMap) as unknown as T;
  }

  if (method === "POST" && (params = match(base, "/workitems/:id/jira-comment"))) {
    // En producción: disparar Power Automate flow
    return { success: true, message: "Comentario registrado (pendiente sincronización Jira)" } as unknown as T;
  }

  // ════════════════════════════════════════════════════════
  //  EVIDENCES
  // ════════════════════════════════════════════════════════
  if (method === "GET" && match(base, "/evidences")) {
    const filters: string[] = [];
    if (qp.get("entityType")) {
      const eTypeVal = qp.get("entityType") === "WorkItem" ? 100000000 : 100000001;
      filters.push(`cproroad_entitytype eq ${eTypeVal}`);
    }
    if (qp.get("entityId")) filters.push(`cproroad_entityid eq '${qp.get("entityId")}'`);
    const filter = filters.length ? `&$filter=${filters.join(" and ")}` : "";
    const r = await api.retrieveMultipleRecords(E.evidence, `?${SEL.evidence}${filter}&$orderby=createdon desc`);
    return r.entities.map(dvToEvidence) as unknown as T;
  }

  if (method === "POST" && match(base, "/evidences")) {
    const b = body as { entityType: "WorkItem" | "Project"; entityId: string; type: EvidenceType; value: string; comment: string; createdBy?: string };
    const dv: Record<string, any> = {
      cproroad_name:       b.comment || b.value.slice(0, 50) || "Evidencia",
      cproroad_entitytype: b.entityType === "WorkItem" ? 100000000 : 100000001,
      cproroad_entityid:   b.entityId,
      cproroad_type:       EVTYPE_T[b.type],
      cproroad_value:      b.value,
      cproroad_comment:    b.comment,
    };
    if (b.createdBy) dv[`cproroad_createdbyuserid@odata.bind`] = bind(E.appUser + "s", b.createdBy);
    const created = await api.createRecord(E.evidence, dv);
    const r = await api.retrieveRecord(E.evidence, created.id, `?${SEL.evidence}`);
    return dvToEvidence(r) as unknown as T;
  }

  // ════════════════════════════════════════════════════════
  //  ACTIVITY
  // ════════════════════════════════════════════════════════
  if (method === "GET" && match(base, "/activity")) {
    const filters: string[] = [];
    if (qp.get("projectId")) filters.push(`_cproroad_projectid_value eq '${qp.get("projectId")}'`);
    const filter = filters.length ? `&$filter=${filters.join(" and ")}` : "";
    const r = await api.retrieveMultipleRecords(
      E.activityLog, `?${SEL.activityLog}${filter}&$orderby=cproroad_at desc&$top=200`,
    );
    return r.entities.map(dvToActivityLog) as unknown as T;
  }

  // ════════════════════════════════════════════════════════
  //  RISKS
  // ════════════════════════════════════════════════════════
  if (method === "GET" && match(base, "/risks")) {
    const filters: string[] = [];
    if (qp.get("projectId")) filters.push(`_cproroad_projectid_value eq '${qp.get("projectId")}'`);
    if (qp.get("status")) filters.push(`cproroad_status eq ${RSKST_T[qp.get("status") as RiskStatus] ?? 0}`);
    const filter = filters.length ? `&$filter=${filters.join(" and ")}` : "";
    const r = await api.retrieveMultipleRecords(E.risk, `?${SEL.risk}${filter}&$orderby=createdon desc`);
    return r.entities.map(dvToRisk) as unknown as T;
  }

  if (method === "POST" && match(base, "/risks")) {
    const b = body as any;
    const dv: Record<string, any> = {
      cproroad_name:        b.title,
      cproroad_description: b.description ?? "",
      cproroad_severity:    PRI_T[b.severity as Priority],
      cproroad_ownerrole:   ROLE_T[b.ownerRole as AppRole],
      cproroad_duedate:     b.dueDate,
      cproroad_status:      100000000, // Abierto
    };
    if (b.projectId)        dv[`cproroad_projectid@odata.bind`]    = bind(E.project + "s", b.projectId);
    if (b.assignedToUserId) dv[`cproroad_assignedtouserid@odata.bind`] = bind(E.appUser + "s", b.assignedToUserId);
    if (b.linkedWorkItemId) dv[`cproroad_linkedworkitemid@odata.bind`] = bind(E.workItem + "s", b.linkedWorkItemId);
    const created = await api.createRecord(E.risk, dv);
    const r = await api.retrieveRecord(E.risk, created.id, `?${SEL.risk}`);
    return dvToRisk(r) as unknown as T;
  }

  if (method === "PATCH" && (params = match(base, "/risks/:id"))) {
    const b = body as any;
    const dv: Record<string, any> = {};
    if (b.title       !== undefined) dv.cproroad_name        = b.title;
    if (b.description !== undefined) dv.cproroad_description = b.description;
    if (b.severity    !== undefined) dv.cproroad_severity    = PRI_T[b.severity as Priority];
    if (b.ownerRole   !== undefined) dv.cproroad_ownerrole   = ROLE_T[b.ownerRole as AppRole];
    if (b.dueDate     !== undefined) dv.cproroad_duedate     = b.dueDate;
    if (b.status      !== undefined) dv.cproroad_status      = RSKST_T[b.status as RiskStatus];
    if (b.linkedWorkItemId !== undefined)
      dv[`cproroad_linkedworkitemid@odata.bind`] = bind(E.workItem + "s", b.linkedWorkItemId);
    await api.updateRecord(E.risk, params.id, dv);
    const r = await api.retrieveRecord(E.risk, params.id, `?${SEL.risk}`);
    return dvToRisk(r) as unknown as T;
  }

  if (method === "PATCH" && (params = match(base, "/risks/:id/close"))) {
    const b = body as { closeComment: string; closedBy?: string };
    const dv: Record<string, any> = {
      cproroad_status:       RSKST_T["Resuelto"],
      cproroad_closecomment: b.closeComment,
      cproroad_closedon:     new Date().toISOString(),
    };
    if (b.closedBy) dv[`cproroad_closedbyuserid@odata.bind`] = bind(E.appUser + "s", b.closedBy);
    await api.updateRecord(E.risk, params.id, dv);
    const r = await api.retrieveRecord(E.risk, params.id, `?${SEL.risk}`);
    return dvToRisk(r) as unknown as T;
  }

  if (method === "DELETE" && (params = match(base, "/risks/:id"))) {
    await api.deleteRecord(E.risk, params.id);
    return undefined as unknown as T;
  }

  // ════════════════════════════════════════════════════════
  //  REQUESTS
  // ════════════════════════════════════════════════════════
  if (method === "GET" && match(base, "/requests")) {
    const userMap = await loadUsers();
    const filters: string[] = [];
    if (qp.get("status")) filters.push(`cproroad_status eq ${REQST_T[qp.get("status") as RequestStatus] ?? 0}`);
    if (qp.get("type"))   filters.push(`cproroad_type eq ${REQTYPE_T[qp.get("type") as RequestType] ?? 0}`);
    if (qp.get("year"))   filters.push(`cproroad_year eq ${qp.get("year")}`);
    const filter = filters.length ? `&$filter=${filters.join(" and ")}` : "";
    const r = await api.retrieveMultipleRecords(
      E.request, `?${SEL.request}${filter}&$orderby=createdon desc`,
    );
    let reqs = r.entities.map(rec => dvToRequest(rec, userMap));
    const q = qp.get("query")?.toLowerCase();
    if (q) reqs = reqs.filter(req => req.title.toLowerCase().includes(q));
    return reqs as unknown as T;
  }

  if (method === "POST" && match(base, "/requests")) {
    const userMap = await loadUsers();
    const b = body as any;
    const dv: Record<string, any> = {
      cproroad_name:        b.title,
      cproroad_description: b.description ?? "",
      cproroad_year:        b.year ?? new Date().getFullYear(),
      cproroad_type:        REQTYPE_T[b.type as RequestType],
      cproroad_priority:    PRI_T[b.priority as Priority],
      cproroad_status:      REQST_T["Nuevo"],
    };
    if (b.requestedByUserId) dv[`cproroad_requestedbyuserid@odata.bind`]  = bind(E.appUser + "s", b.requestedByUserId);
    if (b.requestedByTeamId) dv[`cproroad_requestedbyteamid@odata.bind`]  = bind(E.team + "s", b.requestedByTeamId);
    if (b.relatedProjectId)  dv[`cproroad_relatedprojectid@odata.bind`]   = bind(E.project + "s", b.relatedProjectId);
    const created = await api.createRecord(E.request, dv);
    const r = await api.retrieveRecord(E.request, created.id, `?${SEL.request}`);
    return dvToRequest(r, userMap) as unknown as T;
  }

  if (method === "PATCH" && (params = match(base, "/requests/:id"))) {
    const userMap = await loadUsers();
    const b = body as any;
    const dv: Record<string, any> = {};
    if (b.title       !== undefined) dv.cproroad_name        = b.title;
    if (b.description !== undefined) dv.cproroad_description = b.description;
    if (b.type        !== undefined) dv.cproroad_type        = REQTYPE_T[b.type as RequestType];
    if (b.priority    !== undefined) dv.cproroad_priority    = PRI_T[b.priority as Priority];
    if (b.relatedProjectId !== undefined)
      dv[`cproroad_relatedprojectid@odata.bind`] = bind(E.project + "s", b.relatedProjectId);
    await api.updateRecord(E.request, params.id, dv);
    const r = await api.retrieveRecord(E.request, created.id ?? params.id, `?${SEL.request}`);
    return dvToRequest(r, userMap) as unknown as T;
  }

  if (method === "PATCH" && (params = match(base, "/requests/:id/triage"))) {
    const userMap = await loadUsers();
    const b = body as { action: string; note?: string; triageOwnerUserId?: string };
    const statusMap: Record<string, RequestStatus> = {
      "review": "En revisión", "request-info": "Info requerida",
      "approve": "Aprobada", "reject": "Rechazada",
    };
    const newStatus = statusMap[b.action] ?? "En revisión";
    const dv: Record<string, any> = {
      cproroad_status:     REQST_T[newStatus],
      cproroad_triagenote: b.note ?? "",
    };
    if (b.triageOwnerUserId)
      dv[`cproroad_triageowneruserid@odata.bind`] = bind(E.appUser + "s", b.triageOwnerUserId);
    await api.updateRecord(E.request, params.id, dv);
    const r = await api.retrieveRecord(E.request, params.id, `?${SEL.request}`);
    return dvToRequest(r, userMap) as unknown as T;
  }

  if (method === "PATCH" && (params = match(base, "/requests/:id/convert"))) {
    const userMap = await loadUsers();
    const b = body as any;
    // Crear workitem
    const wiDv: Record<string, any> = {
      cproroad_name:     b.title,
      cproroad_type:     WITYPE_T[b.type as WorkItemType ?? "Feature"],
      cproroad_priority: PRI_T[b.priority as Priority ?? "Media"],
      cproroad_progress: 0,
      cproroad_syncstatus: 100000001,
    };
    if (b.projectId)        wiDv[`cproroad_projectid@odata.bind`]       = bind(E.project + "s", b.projectId);
    if (b.assignedToUserId) wiDv[`cproroad_assignedtouserid@odata.bind`] = bind(E.appUser + "s", b.assignedToUserId);
    if (b.assignedToTeamId) wiDv[`cproroad_assignedtoteamid@odata.bind`] = bind(E.team + "s", b.assignedToTeamId);
    const wiCreated = await api.createRecord(E.workItem, wiDv);
    // Actualizar request: Convertida + vínculo al workitem
    await api.updateRecord(E.request, params.id, {
      cproroad_status: REQST_T["Convertida"],
      [`cproroad_convertedworkitemid@odata.bind`]: bind(E.workItem + "s", wiCreated.id),
    });
    const r = await api.retrieveRecord(E.request, params.id, `?${SEL.request}`);
    return dvToRequest(r, userMap) as unknown as T;
  }

  if (method === "PATCH" && (params = match(base, "/requests/:id/cancel"))) {
    const userMap = await loadUsers();
    const b = body as { note?: string };
    await api.updateRecord(E.request, params.id, {
      cproroad_status:       REQST_T["Cancelada"],
      cproroad_cancelednote: b.note ?? "",
    });
    const r = await api.retrieveRecord(E.request, params.id, `?${SEL.request}`);
    return dvToRequest(r, userMap) as unknown as T;
  }

  if (method === "PATCH" && (params = match(base, "/requests/:id/respond"))) {
    const userMap = await loadUsers();
    const b = body as { note: string };
    await api.updateRecord(E.request, params.id, {
      cproroad_status:     REQST_T["Nuevo"],
      cproroad_triagenote: b.note,
    });
    const r = await api.retrieveRecord(E.request, params.id, `?${SEL.request}`);
    return dvToRequest(r, userMap) as unknown as T;
  }

  if (method === "DELETE" && (params = match(base, "/requests/:id"))) {
    await api.deleteRecord(E.request, params.id);
    return undefined as unknown as T;
  }

  // ════════════════════════════════════════════════════════
  //  ADMIN — SETTINGS & WIP
  // ════════════════════════════════════════════════════════
  if (method === "GET" && match(base, "/admin/settings")) {
    // SystemSettings: primer registro (singleton)
    const sr = await api.retrieveMultipleRecords(E.systemSettings, `?${SEL.sysSettings}&$top=1`);
    const s = sr.entities[0];
    const settings: SystemSettings = s ? {
      strictValidation:        s.cproroad_strictvalidation ?? true,
      adminBypass:             s.cproroad_adminbypass ?? true,
      closeCommentRequired:    s.cproroad_closecommentrequired ?? false,
      closeChecklistRequired:  s.cproroad_closechecklistrequired ?? false,
      workdays:                s.cproroad_weekdays ?? 5,
      jiraSyncEnabled:         s.cproroad_jirasyncenabled ?? false,
    } : {
      strictValidation: true, adminBypass: true, closeCommentRequired: false,
      closeChecklistRequired: false, workdays: 5, jiraSyncEnabled: false,
    };
    // WIP limits
    const wr = await api.retrieveMultipleRecords(E.wipConfig, `?${SEL.wipConfig}`);
    const wipLimits: WipLimits = {};
    wr.entities.forEach(w => {
      const sid = lookup(w, "cproroad_stateid");
      if (sid) wipLimits[sid] = w.cproroad_limit ?? 0;
    });
    return { settings, wipLimits } as unknown as T;
  }

  if (method === "PATCH" && match(base, "/admin/settings")) {
    const b = body as Record<string, any>;
    const dv: Record<string, any> = {};
    if (b.strictValidation       !== undefined) dv.cproroad_strictvalidation      = b.strictValidation;
    if (b.adminBypass            !== undefined) dv.cproroad_adminbypass           = b.adminBypass;
    if (b.closeCommentRequired   !== undefined) dv.cproroad_closecommentrequired  = b.closeCommentRequired;
    if (b.closeChecklistRequired !== undefined) dv.cproroad_closechecklistrequired = b.closeChecklistRequired;
    if (b.workdays               !== undefined) dv.cproroad_weekdays              = b.workdays;
    if (b.jiraSyncEnabled        !== undefined) dv.cproroad_jirasyncenabled       = b.jiraSyncEnabled;
    const sr = await api.retrieveMultipleRecords(E.systemSettings, `?$select=cproroad_systemsettingsid&$top=1`);
    const recId = sr.entities[0]?.cproroad_systemsettingsid as string;
    if (recId) await api.updateRecord(E.systemSettings, recId, dv);
    else       await api.createRecord(E.systemSettings, { ...dv, cproroad_name: "Default" });
    return (await dvRequest("GET", "/admin/settings")) as unknown as T;
  }

  if (method === "PATCH" && match(base, "/admin/wip-limits")) {
    const b = body as Record<string, number>;
    for (const [stateId, limit] of Object.entries(b)) {
      const existing = await api.retrieveMultipleRecords(
        E.wipConfig,
        `?$select=cproroad_wipconfigid&$filter=_cproroad_stateid_value eq '${stateId}'&$top=1`,
      );
      const dv: Record<string, any> = { cproroad_limit: limit };
      if (existing.entities.length > 0) {
        await api.updateRecord(E.wipConfig, existing.entities[0].cproroad_wipconfigid as string, dv);
      } else {
        dv.cproroad_name = `WIP-${stateId}`;
        dv[`cproroad_stateid@odata.bind`] = bind(E.state + "s", stateId);
        await api.createRecord(E.wipConfig, dv);
      }
    }
    return body as unknown as T;
  }

  // ════════════════════════════════════════════════════════
  //  ADMIN — ROLE PERMISSIONS (RBAC)
  // ════════════════════════════════════════════════════════
  if (method === "GET" && match(base, "/admin/role-permissions")) {
    // Catálogo de permisos
    const pr = await api.retrieveMultipleRecords(E.rbacPermission, `?${SEL.rbacPerm}`);
    const permissions: RbacPermission[] = pr.entities.map(r => ({
      key:   r.cproroad_name ?? "",
      label: r.cproroad_label ?? "",
      group: RBACGRP_F[r.cproroad_group as number] ?? "VISTAS",
    }));
    // Valores por rol
    const rpr = await api.retrieveMultipleRecords(E.rolePermission, `?${SEL.rolePerms}`);
    const rolePermissions: RolePermissionsMap = {};
    rpr.entities.forEach(r => {
      const role = ROLE_F[r.cproroad_role as number];
      if (!role) return;
      if (!rolePermissions[role]) rolePermissions[role] = {};
      rolePermissions[role][r.cproroad_permissionkey as string] = r.cproroad_value ?? false;
    });
    return { permissions, rolePermissions } as unknown as T;
  }

  if (method === "PATCH" && match(base, "/admin/role-permissions")) {
    const b = body as { role: AppRole; key: string; value: boolean };
    const roleVal = ROLE_T[b.role];
    const existing = await api.retrieveMultipleRecords(
      E.rolePermission,
      `?$select=cproroad_rolepermissionid&$filter=cproroad_role eq ${roleVal} and cproroad_permissionkey eq '${b.key}'&$top=1`,
    );
    if (existing.entities.length > 0) {
      await api.updateRecord(
        E.rolePermission,
        existing.entities[0].cproroad_rolepermissionid as string,
        { cproroad_value: b.value },
      );
    } else {
      await api.createRecord(E.rolePermission, {
        cproroad_name:          `${b.role}-${b.key}`,
        cproroad_role:          roleVal,
        cproroad_permissionkey: b.key,
        cproroad_value:         b.value,
      });
    }
    return dvRequest("GET", "/admin/role-permissions") as unknown as T;
  }

  if (method === "POST" && match(base, "/admin/role-permissions/reset")) {
    // Eliminar todos y dejar que el seed los recree
    const all = await api.retrieveMultipleRecords(E.rolePermission, "?$select=cproroad_rolepermissionid");
    await Promise.all(all.entities.map(r => api.deleteRecord(E.rolePermission, r.cproroad_rolepermissionid as string)));
    return dvRequest("GET", "/admin/role-permissions") as unknown as T;
  }

  // ════════════════════════════════════════════════════════
  //  ADMIN — AUDIT
  // ════════════════════════════════════════════════════════
  if (method === "GET" && match(base, "/admin/audit")) {
    const r = await api.retrieveMultipleRecords(
      E.activityLog, `?${SEL.activityLog}&$orderby=cproroad_at desc&$top=500`,
    );
    return r.entities.map(dvToActivityLog) as unknown as T;
  }

  // ════════════════════════════════════════════════════════
  //  PERMISSION PROFILES
  // ════════════════════════════════════════════════════════
  if (method === "GET" && match(base, "/permission-profiles")) {
    const r = await api.retrieveMultipleRecords(E.permissionProfile, `?${SEL.permProfile}`);
    return r.entities.map(dvToPermProfile) as unknown as T;
  }

  if (method === "POST" && match(base, "/permission-profiles")) {
    const b = body as { name: string; label: string; description?: string };
    const dv = { cproroad_name: b.name, cproroad_label: b.label, cproroad_description: b.description ?? "", cproroad_isactive: true };
    const created = await api.createRecord(E.permissionProfile, dv);
    const r = await api.retrieveRecord(E.permissionProfile, created.id, `?${SEL.permProfile}`);
    return dvToPermProfile(r) as unknown as T;
  }

  if (method === "PATCH" && (params = match(base, "/permission-profiles/:id"))) {
    const b = body as Partial<PermissionProfile>;
    const dv: Record<string, any> = {};
    if (b.name        !== undefined) dv.cproroad_name        = b.name;
    if (b.label       !== undefined) dv.cproroad_label       = b.label;
    if (b.description !== undefined) dv.cproroad_description = b.description;
    if (b.isActive    !== undefined) dv.cproroad_isactive    = b.isActive;
    await api.updateRecord(E.permissionProfile, params.id, dv);
    const r = await api.retrieveRecord(E.permissionProfile, params.id, `?${SEL.permProfile}`);
    return dvToPermProfile(r) as unknown as T;
  }

  // ════════════════════════════════════════════════════════
  //  PROFILE PERMISSIONS (catálogo perms de un perfil)
  // ════════════════════════════════════════════════════════
  if (method === "GET" && match(base, "/profile-permissions")) {
    const r = await api.retrieveMultipleRecords(E.profilePermission, `?${SEL.profPerm}`);
    return r.entities.map(dvToProfPerm) as unknown as T;
  }

  if (method === "POST" && match(base, "/profile-permissions")) {
    const b = body as { profileId: string; permissionKey: string };
    const dv: Record<string, any> = {
      cproroad_name:          b.permissionKey,
      cproroad_permissionkey: b.permissionKey,
      [`cproroad_profileid@odata.bind`]: bind(E.permissionProfile + "s", b.profileId),
    };
    const created = await api.createRecord(E.profilePermission, dv);
    const r = await api.retrieveRecord(E.profilePermission, created.id, `?${SEL.profPerm}`);
    return dvToProfPerm(r) as unknown as T;
  }

  if (method === "DELETE" && (params = match(base, "/profile-permissions/:id"))) {
    await api.deleteRecord(E.profilePermission, params.id);
    return undefined as unknown as T;
  }

  // ════════════════════════════════════════════════════════
  //  USER PROFILES (asignación perfil ↔ usuario)
  // ════════════════════════════════════════════════════════
  if (method === "GET" && (params = match(base, "/users/:userId/profiles"))) {
    const r = await api.retrieveMultipleRecords(
      E.userProfile,
      `?${SEL.userProfile}&$filter=_cproroad_userid_value eq '${params.userId}'`,
    );
    return r.entities.map(dvToUserProfile) as unknown as T;
  }

  if (method === "POST" && (params = match(base, "/users/:userId/profiles"))) {
    const b = body as { profileId: string };
    const dv: Record<string, any> = {
      cproroad_name:    `UP-${params.userId}-${b.profileId}`,
      cproroad_assignedon: new Date().toISOString(),
      [`cproroad_userid@odata.bind`]:   bind(E.appUser + "s", params.userId),
      [`cproroad_profileid@odata.bind`]: bind(E.permissionProfile + "s", b.profileId),
    };
    const created = await api.createRecord(E.userProfile, dv);
    invalidateUserCache();
    const r = await api.retrieveRecord(E.userProfile, created.id, `?${SEL.userProfile}`);
    return dvToUserProfile(r) as unknown as T;
  }

  if (method === "DELETE" && (params = match(base, "/users/:userId/profiles/:profileId"))) {
    // profileId aquí es el ID del registro UserProfile (no del perfil)
    const existing = await api.retrieveMultipleRecords(
      E.userProfile,
      `?$select=cproroad_userprofileid&$filter=_cproroad_userid_value eq '${params.userId}' and _cproroad_profileid_value eq '${params.profileId}'&$top=1`,
    );
    if (existing.entities.length > 0) {
      await api.deleteRecord(E.userProfile, existing.entities[0].cproroad_userprofileid as string);
    }
    invalidateUserCache();
    return undefined as unknown as T;
  }

  // ════════════════════════════════════════════════════════
  //  USER PERMISSION OVERRIDES
  // ════════════════════════════════════════════════════════
  if (method === "GET" && (params = match(base, "/users/:userId/overrides"))) {
    const r = await api.retrieveMultipleRecords(
      E.userPermOverride,
      `?${SEL.userOverride}&$filter=_cproroad_userid_value eq '${params.userId}'`,
    );
    return r.entities.map(dvToUserOverride) as unknown as T;
  }

  if (method === "POST" && (params = match(base, "/users/:userId/overrides"))) {
    const b = body as { permissionKey: string; value: boolean; reason: string };
    // Upsert: actualizar si existe, crear si no
    const existing = await api.retrieveMultipleRecords(
      E.userPermOverride,
      `?$select=cproroad_userpermissionoverrideid&$filter=_cproroad_userid_value eq '${params.userId}' and cproroad_permissionkey eq '${b.permissionKey}'&$top=1`,
    );
    const dv: Record<string, any> = {
      cproroad_name:          b.permissionKey,
      cproroad_permissionkey: b.permissionKey,
      cproroad_value:         b.value,
      cproroad_reason:        b.reason,
    };
    let recId: string;
    if (existing.entities.length > 0) {
      recId = existing.entities[0].cproroad_userpermissionoverrideid as string;
      await api.updateRecord(E.userPermOverride, recId, dv);
    } else {
      dv[`cproroad_userid@odata.bind`] = bind(E.appUser + "s", params.userId);
      const created = await api.createRecord(E.userPermOverride, dv);
      recId = created.id;
    }
    const r = await api.retrieveRecord(E.userPermOverride, recId, `?${SEL.userOverride}`);
    return dvToUserOverride(r) as unknown as T;
  }

  if (method === "DELETE" && (params = match(base, "/users/:userId/overrides/:overrideId"))) {
    await api.deleteRecord(E.userPermOverride, params.overrideId);
    return undefined as unknown as T;
  }

  // ════════════════════════════════════════════════════════
  //  EFFECTIVE PERMISSIONS
  // ════════════════════════════════════════════════════════
  if (method === "GET" && (params = match(base, "/users/:userId/effective-permissions"))) {
    return computeEffectivePermissions(params.userId) as unknown as T;
  }

  // ════════════════════════════════════════════════════════
  //  TENANT USER SEARCH (Office 365 Users connector)
  // ════════════════════════════════════════════════════════

  if (method === "GET" && match(base, "/admin/tenant-users")) {
    const q = qp.get("q") ?? "";
    const results = await searchTenantUsersViaOffice365(q);
    return results as unknown as T;
  }

  // ════════════════════════════════════════════════════════
  //  NOT FOUND
  // ════════════════════════════════════════════════════════
  throw new Error(`[dataverseBridge] Ruta no implementada: ${method} ${path}`);
}
