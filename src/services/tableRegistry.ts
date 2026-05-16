// ─────────────────────────────────────────────────────────────────────────────
//  src/services/tableRegistry.ts
//
//  Registro único de todas las tablas de Dataverse del proyecto.
//  Exportado aquí para que tanto dataverseSdk.ts como msalDataverse.ts
//  puedan importarlo sin generar una dependencia circular.
// ─────────────────────────────────────────────────────────────────────────────

export const ALL_TABLES_DSI = {
  businessArea:       { logicalName: "cproroad_businessarea",           entitySetName: "cproroad_businessareas" },
  team:               { logicalName: "cproroad_team",                   entitySetName: "cproroad_teams" },
  state:              { logicalName: "cproroad_state",                  entitySetName: "cproroad_states" },
  appUser:            { logicalName: "cproroad_appuser",                entitySetName: "cproroad_appusers" },
  permProfile:        { logicalName: "cproroad_permissionprofile",      entitySetName: "cproroad_permissionprofiles" },
  rbacPermission:     { logicalName: "cproroad_rbacpermission",         entitySetName: "cproroad_rbacpermissions" },
  project:            { logicalName: "cproroad_project",                entitySetName: "cproroad_projects" },
  workItem:           { logicalName: "cproroad_workitem",               entitySetName: "cproroad_workitems" },
  request:            { logicalName: "cproroad_request",                entitySetName: "cproroad_requests" },
  evidence:           { logicalName: "cproroad_evidence",               entitySetName: "cproroad_evidences" },
  activityLog:        { logicalName: "cproroad_activitylog",            entitySetName: "cproroad_activitylogs" },
  risk:               { logicalName: "cproroad_risk",                   entitySetName: "cproroad_risks" },
  transition:         { logicalName: "cproroad_transition",             entitySetName: "cproroad_transitions" },
  rolePermission:     { logicalName: "cproroad_rolepermission",         entitySetName: "cproroad_rolepermissions" },
  profilePermission:  { logicalName: "cproroad_profilepermission",      entitySetName: "cproroad_profilepermissions" },
  userProfile:        { logicalName: "cproroad_userprofile",            entitySetName: "cproroad_userprofiles" },
  userOverride:       { logicalName: "cproroad_userpermissionoverride", entitySetName: "cproroad_userpermissionoverrides" },
  systemSettings:     { logicalName: "cproroad_systemsettings",         entitySetName: "cproroad_systemsettingses" },
  actionRequest:      { logicalName: "cproroad_actionrequest",          entitySetName: "cproroad_actionrequests" },
  wipConfig:          { logicalName: "cproroad_wipconfig",              entitySetName: "cproroad_wipconfigs" },
  // Tablas del sistema (solo lectura)
  systemUser:         { logicalName: "systemuser",                      entitySetName: "systemusers",             isHidden: true },
} as const;
