#Requires -Version 5.1
<#
.SYNOPSIS
  Inserta los datos mock (db.json) en las tablas de Dataverse DEV
  para las pantallas de Administración.

.DESCRIPTION
  Tablas que rellena:
    cproroad_businessarea        → Áreas de negocio
    cproroad_team                → Equipos (Área, Proveedor, Interno)
    cproroad_state               → Estados del flujo
    cproroad_transition          → Transiciones entre estados
    cproroad_appuser             → Usuarios de la app (roles del sistema)
    cproroad_rbacpermission      → Catálogo de permisos RBAC
    cproroad_rolepermission      → Valores rol×permiso
    cproroad_systemsettings      → Configuración global (1 registro)
    cproroad_wipconfig           → Límites WIP por estado

  Entorno DEV : 8d4eb458-70b4-e902-ad69-15739a4e304d
  Org URL     : https://org4e3f8413.crm4.dynamics.com

.NOTES
  El script es idempotente en cuanto a autenticación, pero NO verifica
  duplicados: ejecutarlo dos veces creará registros duplicados.
  Para re-seed limpio, borra primero los registros desde Power Apps / Make.
#>
param(
    [string]$OrgUrl   = "https://org4e3f8413.crm4.dynamics.com",
    [string]$ClientId = "1950a258-227b-4e31-a9cf-717495945fc2"  # PAC CLI public app
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"
$ProgressPreference    = "SilentlyContinue"

# ────────────────────────────────────────────────────────────────────────────
# 0. MSAL.PS
# ────────────────────────────────────────────────────────────────────────────
if (-not (Get-Module -Name MSAL.PS -ListAvailable)) {
    Write-Host "[SETUP] Instalando MSAL.PS..." -ForegroundColor Cyan
    Install-Module -Name MSAL.PS -Scope CurrentUser -Force -AllowClobber
}
Import-Module MSAL.PS -Force -ErrorAction Stop

# ────────────────────────────────────────────────────────────────────────────
# 1. Auth (device-code)
# ────────────────────────────────────────────────────────────────────────────
function Get-TenantId([string]$domain) {
    try {
        $r = Invoke-RestMethod "https://login.microsoftonline.com/$domain/.well-known/openid-configuration"
        if ($r.issuer -match '([0-9a-f-]{36})') { return $Matches[1] }
    } catch {}
    return "common"
}

$upnDomain = "globalia.com"
$tenantId  = Get-TenantId $upnDomain
$resource  = $OrgUrl.TrimEnd('/') + "/"

Write-Host "[AUTH] Iniciando device-code para $OrgUrl ..." -ForegroundColor Cyan
Write-Host "       Abre https://microsoft.com/devicelogin con el código que aparezca." -ForegroundColor Yellow

$tokenParams = @{ ClientId=$ClientId; TenantId=$tenantId; Scopes=@("${resource}.default"); DeviceCode=$true }
try {
    $token = Get-MsalToken @tokenParams
} catch {
    Write-Host "[AUTH] Reintentando con PAC CLI App ID..." -ForegroundColor Yellow
    $tokenParams.ClientId = "1950a258-227b-4e31-a9cf-717495945fc2"
    $token = Get-MsalToken @tokenParams
}

$hdr = @{
    "Authorization"    = "Bearer $($token.AccessToken)"
    "Content-Type"     = "application/json; charset=utf-8"
    "OData-MaxVersion" = "4.0"
    "OData-Version"    = "4.0"
    "Accept"           = "application/json"
}
$apiBase = "$OrgUrl/api/data/v9.2"
Write-Host "[AUTH] OK`n" -ForegroundColor Green

# ────────────────────────────────────────────────────────────────────────────
# Helpers
# ────────────────────────────────────────────────────────────────────────────
function DvPost([string]$entity, [hashtable]$body) {
    $url  = "$apiBase/$entity"
    $json = $body | ConvertTo-Json -Depth 5 -Compress
    $resp = Invoke-RestMethod -Uri $url -Method Post -Headers $hdr -Body $json `
                              -ContentType "application/json; charset=utf-8"
    # Devuelve el GUID del registro creado (viene en el header OData-EntityId)
    # Invoke-RestMethod no expone headers → hacemos GET de vuelta solo cuando necesitemos el GUID
    return $resp
}

function DvPostReturnId([string]$entity, [hashtable]$body) {
    $url  = "$apiBase/$entity"
    $json = $body | ConvertTo-Json -Depth 5 -Compress
    try {
        $resp = Invoke-WebRequest -Uri $url -Method Post -Headers $hdr `
                                  -Body $json -ContentType "application/json; charset=utf-8"
        $eid  = $resp.Headers["OData-EntityId"]
        if ($eid -is [array]) { $eid = $eid[0] }
        if ($eid -match '\(([0-9a-f-]{36})\)') { return $Matches[1] }
        return $null
    } catch {
        $errStream = $_.Exception.Response.GetResponseStream()
        if ($errStream) {
            $reader  = New-Object System.IO.StreamReader($errStream)
            $errBody = $reader.ReadToEnd()
            Write-Host "  [ERROR 400] $errBody" -ForegroundColor Red
        }
        throw
    }
}

function Progress([string]$section, [int]$i, [int]$total, [string]$name) {
    Write-Host ("  [{0}/{1}] {2} — {3}" -f $i, $total, $section, $name) -ForegroundColor Gray
}

# ────────────────────────────────────────────────────────────────────────────
# CHOICE MAPS (enteros Dataverse)
# ────────────────────────────────────────────────────────────────────────────
$ROLE = @{ "Admin"=100000000; "IT AirEuropa"=100000001; "Proveedor"=100000002; "Usuario"=100000003; "Invitado"=100000004 }
$TEAM_TYPE = @{ "Area"=100000000; "Provider"=100000001; "Internal"=100000002 }
$RBAC_GROUP = @{ "TAREAS"=100000000; "TRANSICIONES"=100000001; "VISTAS"=100000002 }

# ============================================================================
# 1. BUSINESS AREAS
# ============================================================================
Write-Host "=== 1. Business Areas ===" -ForegroundColor Cyan
$businessAreas = @(
    @{ name="Aeronova" },
    @{ name="Cargas DENODO" },
    @{ name="Catering" },
    @{ name="DIROPS" },
    @{ name="Evolutivo Interno ITSGT" },
    @{ name="Intrucción PGI" },
    @{ name="Interline" },
    @{ name="Jefatura TCPs AEA" },
    @{ name="Jefatura TCPs AEE" },
    @{ name="DIRPROD" }
)
$i = 0
foreach ($ba in $businessAreas) {
    $i++
    Progress "BA" $i $businessAreas.Count $ba.name
    DvPostReturnId "cproroad_businessareas" @{ cproroad_name=$ba.name } | Out-Null
}
Write-Host "  -> $i áreas creadas`n" -ForegroundColor Green

# ============================================================================
# 2. TEAMS
# ============================================================================
Write-Host "=== 2. Teams ===" -ForegroundColor Cyan
$teams_data = @(
    @{ name="IT AirEuropa"; type="Internal"; isActive=$true  },
    @{ name="DIROPS";       type="Area";     isActive=$true  },
    @{ name="DIRPROD";      type="Area";     isActive=$true  },
    @{ name="TCPs AEA";     type="Area";     isActive=$true  },
    @{ name="TCPs AEE";     type="Area";     isActive=$true  },
    @{ name="Catering";     type="Area";     isActive=$true  },
    @{ name="DENODO";       type="Area";     isActive=$true  },
    @{ name="40West";       type="Provider"; isActive=$true  },
    @{ name="SkyTech";      type="Provider"; isActive=$true  },
    @{ name="BlueCloud";    type="Provider"; isActive=$true  },
    @{ name="ZenDev";       type="Provider"; isActive=$false }
)
$i = 0
foreach ($t in $teams_data) {
    $i++
    Progress "Team" $i $teams_data.Count $t.name
    DvPostReturnId "cproroad_teams" @{
        cproroad_name     = $t.name
        cproroad_type     = $TEAM_TYPE[$t.type]
        cproroad_isactive = $t.isActive
    } | Out-Null
}
Write-Host "  -> $i equipos creados`n" -ForegroundColor Green

# ============================================================================
# 3. STATES (guardamos GUIDs para usarlos en transitions y wipconfig)
# ============================================================================
Write-Host "=== 3. States ===" -ForegroundColor Cyan
$states_data = @(
    @{ name="Nuevo";               category="Pendiente"; order=10 },
    @{ name="Refinamiento";        category="Pendiente"; order=20 },
    @{ name="En curso";            category="En curso";  order=30 },
    @{ name="Bloqueado";           category="Bloqueado"; order=40 },
    @{ name="Listo para pruebas";  category="En curso";  order=50 },
    @{ name="En pruebas";          category="En curso";  order=60 },
    @{ name="Aceptado";            category="En curso";  order=70 },
    @{ name="Cerrado";             category="Cerrado";   order=80 }
)

# Mapa nombre → GUID de Dataverse
$stateGuid = @{}
$i = 0
foreach ($s in $states_data) {
    $i++
    Progress "State" $i $states_data.Count $s.name
    $guid = DvPostReturnId "cproroad_states" @{
        cproroad_name     = $s.name
        cproroad_category = $s.category
        cproroad_order    = $s.order
    }
    $stateGuid[$s.name] = $guid
    Write-Host "       GUID: $guid" -ForegroundColor DarkGray
}
Write-Host "  -> $i estados creados`n" -ForegroundColor Green

# ============================================================================
# 4. TRANSITIONS
# ============================================================================
Write-Host "=== 4. Transitions ===" -ForegroundColor Cyan

# Helper: construye el body de una transición
function MakeTransBody([string]$from, [string]$to, [string[]]$allowedRoles,
                       [string[]]$assignToRole, [bool]$autoTeam,
                       [bool]$requireUser, [bool]$requireEvidence,
                       [string[]]$evTypes, [bool]$requireComment, [bool]$confirm) {
    $body = @{
        cproroad_name                    = "$from -> $to"
        cproroad_allowedroles            = ($allowedRoles | ConvertTo-Json -Compress)
        cproroad_assigntorole            = ($assignToRole | ConvertTo-Json -Compress)
        cproroad_autoassignteam          = $autoTeam
        cproroad_requireuserassignment   = $requireUser
        cproroad_requireevidence         = $requireEvidence
        cproroad_evidencetypes           = ($evTypes | ConvertTo-Json -Compress)
        cproroad_requirecomment          = $requireComment
        cproroad_confirmmove             = $confirm
    }
    # Lookups OData bind
    $fromGuid = $stateGuid[$from]
    $toGuid   = $stateGuid[$to]
    if ($fromGuid) { $body["cproroad_fromstateid@odata.bind"] = "/cproroad_states($fromGuid)" }
    if ($toGuid)   { $body["cproroad_tostateid@odata.bind"]   = "/cproroad_states($toGuid)" }
    return $body
}

$transitions_data = @(
    @{ from="Nuevo";              to="Refinamiento";       allowed=@("Admin","IT AirEuropa");                 assignTo=@("IT AirEuropa"); autoTeam=$true;  reqUser=$false; reqEvid=$false; evTypes=@();                      reqComment=$false; confirm=$false },
    @{ from="Refinamiento";       to="En curso";           allowed=@("Admin","IT AirEuropa");                 assignTo=@("Proveedor");    autoTeam=$true;  reqUser=$true;  reqEvid=$false; evTypes=@();                      reqComment=$false; confirm=$false },
    @{ from="En curso";           to="Listo para pruebas"; allowed=@("Admin","Proveedor");                    assignTo=@("IT AirEuropa"); autoTeam=$true;  reqUser=$true;  reqEvid=$true;  evTypes=@("link","comment","file"); reqComment=$false; confirm=$false },
    @{ from="Listo para pruebas"; to="En pruebas";         allowed=@("Admin","IT AirEuropa");                 assignTo=@("Usuario");      autoTeam=$true;  reqUser=$true;  reqEvid=$false; evTypes=@();                      reqComment=$false; confirm=$false },
    @{ from="En pruebas";         to="Aceptado";           allowed=@("Admin","IT AirEuropa","Usuario");       assignTo=@("IT AirEuropa"); autoTeam=$true;  reqUser=$false; reqEvid=$true;  evTypes=@("comment");             reqComment=$false; confirm=$false },
    @{ from="Aceptado";           to="Cerrado";            allowed=@("Admin","IT AirEuropa");                 assignTo=@("IT AirEuropa"); autoTeam=$true;  reqUser=$false; reqEvid=$false; evTypes=@();                      reqComment=$true;  confirm=$true  },
    @{ from="En curso";           to="Bloqueado";          allowed=@("Admin","IT AirEuropa","Proveedor");     assignTo=@("IT AirEuropa"); autoTeam=$true;  reqUser=$false; reqEvid=$false; evTypes=@();                      reqComment=$true;  confirm=$false },
    @{ from="Bloqueado";          to="En curso";           allowed=@("Admin","IT AirEuropa");                 assignTo=@("Proveedor");    autoTeam=$true;  reqUser=$true;  reqEvid=$false; evTypes=@();                      reqComment=$false; confirm=$false }
)

$i = 0
foreach ($tr in $transitions_data) {
    $i++
    $label = "$($tr.from) → $($tr.to)"
    Progress "Transition" $i $transitions_data.Count $label
    $body = MakeTransBody $tr.from $tr.to $tr.allowed $tr.assignTo `
                          $tr.autoTeam $tr.reqUser $tr.reqEvid $tr.evTypes `
                          $tr.reqComment $tr.confirm
    DvPostReturnId "cproroad_transitions" $body | Out-Null
}
Write-Host "  -> $i transiciones creadas`n" -ForegroundColor Green

# ============================================================================
# 5. APP USERS
# ============================================================================
Write-Host "=== 5. App Users ===" -ForegroundColor Cyan
$appUsers_data = @(
    @{ name="Admin IT";          email="admin@aireuropa.com";      upn="admin@aireuropa.com";      role="Admin";        isActive=$true  },
    @{ name="Juan Carlos Pego";  email="jc.pego@aireuropa.com";    upn="jc.pego@aireuropa.com";    role="IT AirEuropa"; isActive=$true  },
    @{ name="María López";       email="m.lopez@aireuropa.com";    upn="m.lopez@aireuropa.com";    role="IT AirEuropa"; isActive=$true  },
    @{ name="Carlos Vega";       email="c.vega@aireuropa.com";     upn="c.vega@aireuropa.com";     role="Usuario";      isActive=$true  },
    @{ name="Ana Romero";        email="a.romero@aireuropa.com";   upn="a.romero@aireuropa.com";   role="Usuario";      isActive=$false },
    @{ name="Dev 40West";        email="dev@40west.com";           upn="dev@40west.com";           role="Proveedor";    isActive=$true  },
    @{ name="Dev SkyTech";       email="dev@skytech.com";          upn="dev@skytech.com";          role="Proveedor";    isActive=$true  },
    @{ name="Pedro Martínez";    email="p.martinez@aireuropa.com"; upn="p.martinez@aireuropa.com"; role="Invitado";     isActive=$true  },
    @{ name="Laura Sanz";        email="l.sanz@40west.com";        upn="l.sanz@40west.com";        role="Proveedor";    isActive=$true  },
    @{ name="Javier Ruiz";       email="j.ruiz@aireuropa.com";     upn="j.ruiz@aireuropa.com";     role="Usuario";      isActive=$true  },
    @{ name="Dev BlueCloud";     email="dev@bluecloud.com";        upn="dev@bluecloud.com";        role="Proveedor";    isActive=$true  },
    @{ name="Sofía Molina";      email="s.molina@aireuropa.com";   upn="s.molina@aireuropa.com";   role="Usuario";      isActive=$true  }
)
$i = 0
foreach ($u in $appUsers_data) {
    $i++
    Progress "AppUser" $i $appUsers_data.Count $u.name
    DvPostReturnId "cproroad_appusers" @{
        cproroad_name     = $u.name
        cproroad_email    = $u.email
        cproroad_upn      = $u.upn
        cproroad_role     = $ROLE[$u.role]
        cproroad_isactive = $u.isActive
    } | Out-Null
}
Write-Host "  -> $i usuarios creados`n" -ForegroundColor Green

# ============================================================================
# 6. RBAC PERMISSIONS (catálogo)
# ============================================================================
Write-Host "=== 6. RBAC Permissions (catálogo) ===" -ForegroundColor Cyan
$rbac_data = @(
    # TAREAS
    @{ key="TASK_CREATE";      label="Crear tarea";                       group="TAREAS" },
    @{ key="TASK_EDIT";        label="Editar tarea";                      group="TAREAS" },
    @{ key="TASK_CLOSE";       label="Cerrar tarea (desde EN_VALIDACIÓN)";group="TAREAS" },
    @{ key="TASK_REOPEN";      label="Reabrir tarea";                     group="TAREAS" },
    @{ key="TASK_VIEW_ALL";    label="Ver todas las tareas";              group="TAREAS" },
    @{ key="PROJECT_CREATE";   label="Crear proyecto";                    group="TAREAS" },
    @{ key="REQUEST_CREATE";   label="Crear solicitudes";                 group="TAREAS" },
    @{ key="REQUEST_APPROVE";  label="Aprobar / gestionar solicitudes";   group="TAREAS" },
    # TRANSICIONES
    @{ key="TRANS_NEW_PROG";   label="PENDIENTE → EN CURSO";             group="TRANSICIONES" },
    @{ key="TRANS_PROG_RFT";   label="EN CURSO → LISTO PRUEBAS";        group="TRANSICIONES" },
    @{ key="TRANS_RFT_TEST";   label="LISTO PRUEBAS → EN VALIDACIÓN";   group="TRANSICIONES" },
    @{ key="TRANS_TEST_CLS";   label="EN VALIDACIÓN → CERRADO";         group="TRANSICIONES" },
    @{ key="TRANS_BLOCK";      label="Bloquear tarea";                   group="TRANSICIONES" },
    @{ key="TRANS_UNBLOCK";    label="Desbloquear tarea";                group="TRANSICIONES" },
    # VISTAS
    @{ key="VIEW_DASHBOARD";   label="Inicio / Dashboard";               group="VISTAS" },
    @{ key="VIEW_PROJECTS";    label="Proyectos";                        group="VISTAS" },
    @{ key="VIEW_ROADMAP";     label="Roadmap";                          group="VISTAS" },
    @{ key="VIEW_GANTT";       label="Diagrama de Gantt";                group="VISTAS" },
    @{ key="VIEW_REQUESTS";    label="Solicitudes";                      group="VISTAS" },
    @{ key="VIEW_BACKLOG";     label="Backlog";                          group="VISTAS" },
    @{ key="VIEW_KANBAN";      label="Tablero Kanban";                   group="VISTAS" },
    @{ key="VIEW_ACTIVITY";    label="Actividad";                        group="VISTAS" },
    @{ key="VIEW_EVIDENCES";   label="Evidencias";                       group="VISTAS" },
    @{ key="VIEW_REPORTS";     label="Informes / KPIs";                  group="VISTAS" },
    @{ key="VIEW_RISKS";       label="Riesgos y Bloqueos";               group="VISTAS" },
    @{ key="VIEW_AUDIT";       label="Auditoría";                        group="VISTAS" },
    @{ key="VIEW_HOME_SMART";  label="Home Inteligente (nivel 2)";       group="VISTAS" }
)

$i = 0
foreach ($p in $rbac_data) {
    $i++
    Progress "RBAC" $i $rbac_data.Count $p.key
    DvPostReturnId "cproroad_rbacpermissions" @{
        cproroad_name  = $p.key
        cproroad_label = $p.label
        cproroad_group = $RBAC_GROUP[$p.group]
    } | Out-Null
}
Write-Host "  -> $i permisos RBAC creados`n" -ForegroundColor Green

# ============================================================================
# 7. ROLE PERMISSIONS (matriz rol × permiso)
# ============================================================================
Write-Host "=== 7. Role Permissions ===" -ForegroundColor Cyan

# Matriz completa extraída de db.json → rolePermissions
$rolePerms = @{
    "Admin" = @{
        TASK_CREATE=$true; TASK_EDIT=$true; TASK_CLOSE=$true; TASK_REOPEN=$true; TASK_VIEW_ALL=$true
        PROJECT_CREATE=$true
        REQUEST_CREATE=$true; REQUEST_APPROVE=$true
        TRANS_NEW_PROG=$true; TRANS_PROG_RFT=$true; TRANS_RFT_TEST=$true; TRANS_TEST_CLS=$true; TRANS_BLOCK=$true; TRANS_UNBLOCK=$true
        VIEW_DASHBOARD=$true; VIEW_PROJECTS=$true; VIEW_ROADMAP=$true; VIEW_GANTT=$true; VIEW_REQUESTS=$true
        VIEW_BACKLOG=$true; VIEW_KANBAN=$true; VIEW_ACTIVITY=$true; VIEW_EVIDENCES=$true; VIEW_REPORTS=$true
        VIEW_RISKS=$true; VIEW_AUDIT=$true; VIEW_HOME_SMART=$true
    }
    "IT AirEuropa" = @{
        TASK_CREATE=$true; TASK_EDIT=$true; TASK_CLOSE=$true; TASK_REOPEN=$true; TASK_VIEW_ALL=$true
        PROJECT_CREATE=$true
        REQUEST_CREATE=$true; REQUEST_APPROVE=$true
        TRANS_NEW_PROG=$true; TRANS_PROG_RFT=$true; TRANS_RFT_TEST=$true; TRANS_TEST_CLS=$true; TRANS_BLOCK=$true; TRANS_UNBLOCK=$true
        VIEW_DASHBOARD=$true; VIEW_PROJECTS=$true; VIEW_ROADMAP=$true; VIEW_GANTT=$true; VIEW_REQUESTS=$true
        VIEW_BACKLOG=$true; VIEW_KANBAN=$true; VIEW_ACTIVITY=$true; VIEW_EVIDENCES=$true; VIEW_REPORTS=$true
        VIEW_RISKS=$true; VIEW_AUDIT=$true; VIEW_HOME_SMART=$true
    }
    "Proveedor" = @{
        TASK_CREATE=$false; TASK_EDIT=$true; TASK_CLOSE=$false; TASK_REOPEN=$false; TASK_VIEW_ALL=$true
        PROJECT_CREATE=$false
        REQUEST_CREATE=$false; REQUEST_APPROVE=$false
        TRANS_NEW_PROG=$true; TRANS_PROG_RFT=$true; TRANS_RFT_TEST=$false; TRANS_TEST_CLS=$false; TRANS_BLOCK=$true; TRANS_UNBLOCK=$true
        VIEW_DASHBOARD=$true; VIEW_PROJECTS=$true; VIEW_ROADMAP=$false; VIEW_GANTT=$false; VIEW_REQUESTS=$true
        VIEW_BACKLOG=$true; VIEW_KANBAN=$true; VIEW_ACTIVITY=$true; VIEW_EVIDENCES=$true; VIEW_REPORTS=$false
        VIEW_RISKS=$false; VIEW_AUDIT=$false; VIEW_HOME_SMART=$true
    }
    "Usuario" = @{
        TASK_CREATE=$false; TASK_EDIT=$false; TASK_CLOSE=$false; TASK_REOPEN=$false; TASK_VIEW_ALL=$true
        PROJECT_CREATE=$false
        REQUEST_CREATE=$false; REQUEST_APPROVE=$false
        TRANS_NEW_PROG=$false; TRANS_PROG_RFT=$false; TRANS_RFT_TEST=$false; TRANS_TEST_CLS=$false; TRANS_BLOCK=$false; TRANS_UNBLOCK=$false
        VIEW_DASHBOARD=$true; VIEW_PROJECTS=$true; VIEW_ROADMAP=$true; VIEW_GANTT=$true; VIEW_REQUESTS=$true
        VIEW_BACKLOG=$true; VIEW_KANBAN=$true; VIEW_ACTIVITY=$true; VIEW_EVIDENCES=$true; VIEW_REPORTS=$true
        VIEW_RISKS=$false; VIEW_AUDIT=$false; VIEW_HOME_SMART=$true
    }
    "Invitado" = @{
        TASK_CREATE=$false; TASK_EDIT=$false; TASK_CLOSE=$false; TASK_REOPEN=$false; TASK_VIEW_ALL=$false
        PROJECT_CREATE=$false
        REQUEST_CREATE=$false; REQUEST_APPROVE=$false
        TRANS_NEW_PROG=$false; TRANS_PROG_RFT=$false; TRANS_RFT_TEST=$false; TRANS_TEST_CLS=$false; TRANS_BLOCK=$false; TRANS_UNBLOCK=$false
        VIEW_DASHBOARD=$true; VIEW_PROJECTS=$true; VIEW_ROADMAP=$false; VIEW_GANTT=$false; VIEW_REQUESTS=$false
        VIEW_BACKLOG=$true; VIEW_KANBAN=$true; VIEW_ACTIVITY=$false; VIEW_EVIDENCES=$false; VIEW_REPORTS=$false
        VIEW_RISKS=$false; VIEW_AUDIT=$false; VIEW_HOME_SMART=$false
    }
}

$permKeys = $rbac_data | ForEach-Object { $_.key }
$i = 0
$total = $rolePerms.Keys.Count * $permKeys.Count
foreach ($roleName in $rolePerms.Keys) {
    $permsForRole = $rolePerms[$roleName]
    foreach ($permKey in $permKeys) {
        $i++
        $val = $permsForRole[$permKey] -eq $true
        DvPostReturnId "cproroad_rolepermissions" @{
            cproroad_name          = "$roleName|$permKey"
            cproroad_role          = $ROLE[$roleName]
            cproroad_permissionkey = $permKey
            cproroad_value         = $val
        } | Out-Null
    }
    Write-Host ("  Rol '{0}' — {1} permisos insertados" -f $roleName, $permKeys.Count) -ForegroundColor Gray
}
Write-Host "  -> $total entradas rol×permiso creadas`n" -ForegroundColor Green

# ============================================================================
# 8. SYSTEM SETTINGS (registro singleton)
# ============================================================================
Write-Host "=== 8. System Settings ===" -ForegroundColor Cyan
DvPostReturnId "cproroad_systemsettingses" @{
    cproroad_name                    = "Default"
    cproroad_strictvalidation        = $false
    cproroad_adminbypass             = $false
    cproroad_closecommentrequired    = $false
    cproroad_closechecklistrequired  = $false
    cproroad_weekdays                = 5
    cproroad_jirasyncenabled         = $true
} | Out-Null
Write-Host "  -> 1 registro de configuración creado`n" -ForegroundColor Green

# ============================================================================
# 9. WIP CONFIG (límites por estado)
# ============================================================================
Write-Host "=== 9. WIP Config ===" -ForegroundColor Cyan

# Límites de db.json → wipLimits (0 = sin límite)
# Solo guardamos los estados con límite > 0
$wipLimits = @{
    "En curso"  = 5
    "Bloqueado" = 3
}

$i = 0
foreach ($stateName in $wipLimits.Keys) {
    $stateGuidVal = $stateGuid[$stateName]
    if (-not $stateGuidVal) {
        Write-Warning "  Estado '$stateName' sin GUID — omitiendo WIP"
        continue
    }
    $i++
    $limit = $wipLimits[$stateName]
    Progress "WIP" $i $wipLimits.Count "$stateName (límite=$limit)"
    $body = @{
        cproroad_name  = "WIP-$stateName"
        cproroad_limit = $limit
        "cproroad_stateid@odata.bind" = "/cproroad_states($stateGuidVal)"
    }
    DvPostReturnId "cproroad_wipconfigs" $body | Out-Null
}
Write-Host "  -> $i límites WIP creados`n" -ForegroundColor Green

# ============================================================================
# RESUMEN
# ============================================================================
Write-Host "=============================================" -ForegroundColor Green
Write-Host " SEED COMPLETADO - Pantallas Administración  " -ForegroundColor Green
Write-Host "=============================================" -ForegroundColor Green
Write-Host ""
Write-Host "  Tablas rellenas:" -ForegroundColor White
Write-Host "    cproroad_businessarea      : $($businessAreas.Count) registros" -ForegroundColor Gray
Write-Host "    cproroad_team              : $($teams_data.Count) registros" -ForegroundColor Gray
Write-Host "    cproroad_state             : $($states_data.Count) registros" -ForegroundColor Gray
Write-Host "    cproroad_transition        : $($transitions_data.Count) registros" -ForegroundColor Gray
Write-Host "    cproroad_appuser           : $($appUsers_data.Count) registros" -ForegroundColor Gray
Write-Host "    cproroad_rbacpermission    : $($rbac_data.Count) registros" -ForegroundColor Gray
Write-Host "    cproroad_rolepermission    : $total registros (5 roles × $($permKeys.Count) permisos)" -ForegroundColor Gray
Write-Host "    cproroad_systemsettings    : 1 registro" -ForegroundColor Gray
Write-Host "    cproroad_wipconfig         : $i registros" -ForegroundColor Gray
Write-Host ""
Write-Host "  NOTA: abre la app y haz Ctrl+Shift+R para forzar recarga del bundle." -ForegroundColor Yellow
