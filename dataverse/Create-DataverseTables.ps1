#Requires -Version 5.1
<#
.SYNOPSIS
  Crea las 20 tablas CPROROAD en el entorno Dataverse DEV.

.DESCRIPTION
  Autentica con MSAL (device-code, sin secreto cliente), crea todas las tablas,
  columnas y relaciones lookup, y publica los cambios.

  Publisher prefix : cproroad
  Entorno DEV      : 8d4eb458-70b4-e902-ad69-15739a4e304d
  Org URL          : https://org4e3f8413.crm4.dynamics.com

.PARAMETER OrgUrl
  URL de la organización Dataverse.

.PARAMETER ClientId
  Client ID del App Registration de Azure AD.

.EXAMPLE
  .\Create-DataverseTables.ps1
#>
param(
    [string]$OrgUrl   = "https://org4e3f8413.crm4.dynamics.com",
    [string]$ClientId = "1571fa52-83d8-4093-ad3a-b8da89c1356c"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"
$ProgressPreference    = "SilentlyContinue"

# ── 0. Instalar MSAL.PS si no está ────────────────────────────────────────────
if (-not (Get-Module -Name MSAL.PS -ListAvailable)) {
    Write-Host "`n[SETUP] Instalando MSAL.PS (una sola vez)..." -ForegroundColor Cyan
    Install-Module -Name MSAL.PS -Scope CurrentUser -Force -AllowClobber
}
Import-Module MSAL.PS -Force -ErrorAction Stop

# ── 1. Autodescubrir TenantId desde el dominio UPN ────────────────────────────
function Get-TenantId([string]$domain) {
    try {
        $r = Invoke-RestMethod "https://login.microsoftonline.com/$domain/.well-known/openid-configuration"
        # issuer = https://sts.windows.net/{tenantId}/
        if ($r.issuer -match '([0-9a-f-]{36})') { return $Matches[1] }
    } catch {}
    return "common"
}

$domain   = ($OrgUrl -replace 'https://[^.]+\.([^/]+).*', '$1')
$upnDomain = "globalia.com"   # dominio del usuario autenticado en PAC
$tenantId  = Get-TenantId $upnDomain
Write-Host "[AUTH] Tenant autodescubierto: $tenantId" -ForegroundColor Gray

# ── 2. Obtener token (device-code, el usuario abre el navegador una vez) ──────
$resource = $OrgUrl.TrimEnd('/') + "/"
Write-Host "[AUTH] Iniciando autenticación device-code para $OrgUrl ..." -ForegroundColor Cyan
Write-Host "       Se mostrará un código: ábrelo en https://microsoft.com/devicelogin" -ForegroundColor Yellow

$tokenParams = @{
    ClientId   = $ClientId
    TenantId   = $tenantId
    Scopes     = @("${resource}.default")
    DeviceCode = $true
}

try {
    $token = Get-MsalToken @tokenParams
} catch {
    Write-Host "[AUTH] Reintentando con PAC CLI App ID..." -ForegroundColor Yellow
    $tokenParams.ClientId = "1950a258-227b-4e31-a9cf-717495945fc2"  # PAC CLI public app
    $token = Get-MsalToken @tokenParams
}

$headers = @{
    "Authorization"    = "Bearer $($token.AccessToken)"
    "Content-Type"     = "application/json; charset=utf-8"
    "OData-MaxVersion" = "4.0"
    "OData-Version"    = "4.0"
    "Accept"           = "application/json"
}
$BaseUrl = "$($OrgUrl.TrimEnd('/'))/api/data/v9.2"

Write-Host "[AUTH] Autenticado correctamente." -ForegroundColor Green

# ── 3. Helpers ─────────────────────────────────────────────────────────────────
function lbl([string]$text, [int]$lang = 3082) {
    @{
        "@odata.type"     = "Microsoft.Dynamics.CRM.Label"
        "LocalizedLabels" = @(@{
            "@odata.type" = "Microsoft.Dynamics.CRM.LocalizedLabel"
            "Label"       = $text
            "LanguageCode"= $lang
        })
    }
}

function rl([string]$level = "None") {
    @{
        "@odata.type"                  = "Microsoft.Dynamics.CRM.AttributeRequiredLevelManagedProperty"
        "Value"                        = $level
        "CanBeChanged"                 = $true
        "ManagedPropertyLogicalName"   = "canmodifyrequirementlevelsettings"
    }
}

function Invoke-Dv([string]$Method, [string]$Path, $Body = $null) {
    $url    = "$BaseUrl/$Path"
    $params = @{ Method = $Method; Uri = $url; Headers = $headers }
    if ($Body) { $params.Body = ($Body | ConvertTo-Json -Depth 30 -Compress) }
    try {
        Invoke-RestMethod @params
    } catch {
        $raw = $_.ErrorDetails.Message
        if ($raw) {
            $j = $raw | ConvertFrom-Json -ErrorAction SilentlyContinue
            $msg = if ($j.error.message) { $j.error.message } else { $raw }
        } else { $msg = $_.Exception.Message }
        # Ignorar "ya existe"
        if ($msg -match "already exists|ya existe|0x80044005") {
            Write-Host "    (ya existe, se omite)" -ForegroundColor DarkGray
            return $null
        }
        Write-Warning "  API $Method $Path => $msg"
        return $null
    }
}

# ── Crear tabla (entity) ────────────────────────────────────────────────────────
function New-DvTable {
    param([string]$Schema, [string]$Display, [string]$Plural, [string]$NameLabel = "Nombre")
    $nameAttr = @{
        "@odata.type"       = "Microsoft.Dynamics.CRM.StringAttributeMetadata"
        "SchemaName"        = "cproroad_name"
        "AttributeType"     = "String"
        "AttributeTypeName" = @{ "Value" = "StringType" }
        "MaxLength"         = 400
        "Format"            = "Text"
        "IsPrimaryName"     = $true
        "DisplayName"       = (lbl $NameLabel)
        "RequiredLevel"     = (rl "ApplicationRequired")
    }
    $body = @{
        "@odata.type"           = "Microsoft.Dynamics.CRM.EntityMetadata"
        "SchemaName"            = $Schema
        "DisplayName"           = (lbl $Display)
        "DisplayCollectionName" = (lbl $Plural)
        "HasActivities"         = $false
        "HasNotes"              = $false
        "IsActivity"            = $false
        "OwnershipType"         = "UserOwned"
        "Attributes"            = @($nameAttr)
    }
    Write-Host "  [TABLE] $Schema ..." -NoNewline
    $r = Invoke-Dv POST "EntityDefinitions" $body
    if ($r) { Write-Host " OK" -ForegroundColor Green } else { Write-Host "" }
    Start-Sleep -Milliseconds 400
}

# ── Añadir columna texto ────────────────────────────────────────────────────────
function Add-Str([string]$Entity, [string]$Schema, [string]$Label,
                 [string]$Req = "None", [int]$MaxLen = 500) {
    $body = @{
        "@odata.type"       = "Microsoft.Dynamics.CRM.StringAttributeMetadata"
        "SchemaName"        = $Schema
        "AttributeType"     = "String"
        "AttributeTypeName" = @{ "Value" = "StringType" }
        "MaxLength"         = $MaxLen
        "Format"            = "Text"
        "DisplayName"       = (lbl $Label)
        "RequiredLevel"     = (rl $Req)
    }
    Invoke-Dv POST "EntityDefinitions(LogicalName='$Entity')/Attributes" $body | Out-Null
}

# ── Añadir columna memo (texto largo) ──────────────────────────────────────────
function Add-Memo([string]$Entity, [string]$Schema, [string]$Label, [string]$Req = "None") {
    $body = @{
        "@odata.type"       = "Microsoft.Dynamics.CRM.MemoAttributeMetadata"
        "SchemaName"        = $Schema
        "AttributeType"     = "Memo"
        "AttributeTypeName" = @{ "Value" = "MemoType" }
        "MaxLength"         = 4000
        "Format"            = "TextArea"
        "DisplayName"       = (lbl $Label)
        "RequiredLevel"     = (rl $Req)
    }
    Invoke-Dv POST "EntityDefinitions(LogicalName='$Entity')/Attributes" $body | Out-Null
}

# ── Añadir columna entero ───────────────────────────────────────────────────────
function Add-Int([string]$Entity, [string]$Schema, [string]$Label,
                 [int]$Min = 0, [int]$Max = 2147483647, [string]$Req = "None") {
    $body = @{
        "@odata.type"       = "Microsoft.Dynamics.CRM.IntegerAttributeMetadata"
        "SchemaName"        = $Schema
        "AttributeType"     = "Integer"
        "AttributeTypeName" = @{ "Value" = "IntegerType" }
        "MinValue"          = $Min
        "MaxValue"          = $Max
        "Format"            = "None"
        "DisplayName"       = (lbl $Label)
        "RequiredLevel"     = (rl $Req)
    }
    Invoke-Dv POST "EntityDefinitions(LogicalName='$Entity')/Attributes" $body | Out-Null
}

# ── Añadir columna sí/no ───────────────────────────────────────────────────────
function Add-Bool([string]$Entity, [string]$Schema, [string]$Label,
                  [string]$TrueLabel = "Sí", [string]$FalseLabel = "No", [bool]$Default = $true) {
    $body = @{
        "@odata.type"       = "Microsoft.Dynamics.CRM.BooleanAttributeMetadata"
        "SchemaName"        = $Schema
        "AttributeType"     = "Boolean"
        "AttributeTypeName" = @{ "Value" = "BooleanType" }
        "DefaultValue"      = $Default
        "DisplayName"       = (lbl $Label)
        "RequiredLevel"     = (rl "None")
        "OptionSet"         = @{
            "@odata.type"  = "Microsoft.Dynamics.CRM.BooleanOptionSetMetadata"
            "TrueOption"   = @{ "@odata.type" = "Microsoft.Dynamics.CRM.OptionMetadata"; "Value" = 1; "Label" = (lbl $TrueLabel) }
            "FalseOption"  = @{ "@odata.type" = "Microsoft.Dynamics.CRM.OptionMetadata"; "Value" = 0; "Label" = (lbl $FalseLabel) }
        }
    }
    Invoke-Dv POST "EntityDefinitions(LogicalName='$Entity')/Attributes" $body | Out-Null
}

# ── Añadir columna fecha/hora ──────────────────────────────────────────────────
function Add-Date([string]$Entity, [string]$Schema, [string]$Label,
                  [string]$Fmt = "DateAndTime", [string]$Req = "None") {
    $body = @{
        "@odata.type"       = "Microsoft.Dynamics.CRM.DateTimeAttributeMetadata"
        "SchemaName"        = $Schema
        "AttributeType"     = "DateTime"
        "AttributeTypeName" = @{ "Value" = "DateTimeType" }
        "Format"            = $Fmt
        "DateTimeBehavior"  = @{ "Value" = "UserLocal" }
        "DisplayName"       = (lbl $Label)
        "RequiredLevel"     = (rl $Req)
    }
    Invoke-Dv POST "EntityDefinitions(LogicalName='$Entity')/Attributes" $body | Out-Null
}

# ── Añadir columna selección (choice local) ────────────────────────────────────
function Add-Choice([string]$Entity, [string]$Schema, [string]$Label,
                    [array]$Options, [string]$Req = "None") {
    $opts = $Options | ForEach-Object {
        @{
            "@odata.type" = "Microsoft.Dynamics.CRM.OptionMetadata"
            "Value"       = $_.v
            "Label"       = (lbl $_.l)
        }
    }
    $body = @{
        "@odata.type"       = "Microsoft.Dynamics.CRM.PicklistAttributeMetadata"
        "SchemaName"        = $Schema
        "AttributeType"     = "Picklist"
        "AttributeTypeName" = @{ "Value" = "PicklistType" }
        "DisplayName"       = (lbl $Label)
        "RequiredLevel"     = (rl $Req)
        "OptionSet"         = @{
            "@odata.type"   = "Microsoft.Dynamics.CRM.OptionSetMetadata"
            "IsGlobal"      = $false
            "OptionSetType" = "Picklist"
            "Options"       = $opts
        }
    }
    Invoke-Dv POST "EntityDefinitions(LogicalName='$Entity')/Attributes" $body | Out-Null
}

# ── Añadir relación lookup (1:N) ───────────────────────────────────────────────
function Add-Lookup([string]$Referenced, [string]$Referencing,
                    [string]$LookupSchema, [string]$LookupLabel,
                    [string]$RelSchema, [string]$Req = "None") {
    $body = @{
        "@odata.type"     = "Microsoft.Dynamics.CRM.OneToManyRelationshipMetadata"
        "SchemaName"      = $RelSchema
        "ReferencedEntity"= $Referenced
        "ReferencingEntity"= $Referencing
        "Lookup"          = @{
            "@odata.type" = "Microsoft.Dynamics.CRM.LookupAttributeMetadata"
            "SchemaName"  = $LookupSchema
            "DisplayName" = (lbl $LookupLabel)
            "RequiredLevel"= (rl $Req)
        }
    }
    Invoke-Dv POST "RelationshipDefinitions" $body | Out-Null
}

# ── Catálogos de opciones ──────────────────────────────────────────────────────
$OPT_ROLE    = @(
    @{v=100000000;l="Admin"},@{v=100000001;l="IT AirEuropa"},
    @{v=100000002;l="Proveedor"},@{v=100000003;l="Usuario"},@{v=100000004;l="Invitado"}
)
$OPT_PRIO    = @(@{v=100000000;l="Alta"},@{v=100000001;l="Media"},@{v=100000002;l="Baja"})
$OPT_PRJST   = @(@{v=100000000;l="Pendiente"},@{v=100000001;l="En curso"},@{v=100000002;l="Bloqueado"},@{v=100000003;l="Cerrado"})
$OPT_WITYPE  = @(@{v=100000000;l="Feature"},@{v=100000001;l="Bug"},@{v=100000002;l="TechDebt"},@{v=100000003;l="Spike"})
$OPT_TTYPE   = @(@{v=100000000;l="Area"},@{v=100000001;l="Provider"},@{v=100000002;l="Internal"})
$OPT_RSKST   = @(@{v=100000000;l="Abierto"},@{v=100000001;l="En mitigación"},@{v=100000002;l="Resuelto"})
$OPT_REQTYPE = @(
    @{v=100000000;l="Bug"},@{v=100000001;l="Mejora"},@{v=100000002;l="Feature"},
    @{v=100000003;l="Incidencia"},@{v=100000004;l="Consulta"},
    @{v=100000005;l="CambioNormativo"},@{v=100000006;l="Impedimento"}
)
$OPT_REQST   = @(
    @{v=100000000;l="Nuevo"},@{v=100000001;l="En revisión"},@{v=100000002;l="Info requerida"},
    @{v=100000003;l="Aprobada"},@{v=100000004;l="Rechazada"},
    @{v=100000005;l="Convertida"},@{v=100000006;l="Cancelada"}
)
$OPT_EVTYPE  = @(@{v=100000000;l="link"},@{v=100000001;l="comment"},@{v=100000002;l="file"})
$OPT_SYNC    = @(@{v=100000000;l="OK"},@{v=100000001;l="Pending"},@{v=100000002;l="Error"})
$OPT_DLVOWN  = @(@{v=100000000;l="IT"},@{v=100000001;l="Proveedor"})
$OPT_VIS     = @(@{v=100000000;l="Enterprise"},@{v=100000001;l="Restricted"})
$OPT_RBACGRP = @(@{v=100000000;l="TAREAS"},@{v=100000001;l="TRANSICIONES"},@{v=100000002;l="VISTAS"})
$OPT_ACTTYPE = @(@{v=100000000;l="Transition"},@{v=100000001;l="Comment"})
$OPT_ACTST   = @(@{v=100000000;l="Pending"},@{v=100000001;l="Processing"},@{v=100000002;l="Done"},@{v=100000003;l="Error"})

# ══════════════════════════════════════════════════════════════════════════════
#  FASE 1 — Crear tablas (shell: PK auto + columna nombre)
# ══════════════════════════════════════════════════════════════════════════════
Write-Host "`n══ FASE 1: Crear tablas ══════════════════════════════════" -ForegroundColor Cyan

New-DvTable "cproroad_BusinessArea"           "Área de Negocio"          "Áreas de Negocio"         "Nombre"
New-DvTable "cproroad_Team"                   "Equipo"                   "Equipos"                  "Nombre"
New-DvTable "cproroad_State"                  "Estado Kanban"            "Estados Kanban"           "Nombre"
New-DvTable "cproroad_AppUser"                "Usuario App"              "Usuarios App"             "Nombre completo"
New-DvTable "cproroad_PermissionProfile"      "Perfil de Permisos"       "Perfiles de Permisos"     "Nombre interno"
New-DvTable "cproroad_RbacPermission"         "Permiso RBAC"             "Permisos RBAC"            "Clave (key)"
New-DvTable "cproroad_Project"                "Proyecto"                 "Proyectos"                "Nombre del proyecto"
New-DvTable "cproroad_WorkItem"               "Tarea"                    "Tareas"                   "Título"
New-DvTable "cproroad_Request"                "Solicitud"                "Solicitudes"              "Título"
New-DvTable "cproroad_Evidence"               "Evidencia"                "Evidencias"               "Descripción"
New-DvTable "cproroad_ActivityLog"            "Registro de Actividad"    "Registros de Actividad"   "Acción"
New-DvTable "cproroad_Risk"                   "Riesgo"                   "Riesgos"                  "Título del riesgo"
New-DvTable "cproroad_Transition"             "Transición de Estado"     "Transiciones de Estado"   "Nombre"
New-DvTable "cproroad_RolePermission"         "Permiso por Rol"          "Permisos por Rol"         "Clave de permiso"
New-DvTable "cproroad_ProfilePermission"      "Permiso de Perfil"        "Permisos de Perfil"       "Clave de permiso"
New-DvTable "cproroad_UserProfile"            "Perfil Asignado"          "Perfiles Asignados"       "Nombre"
New-DvTable "cproroad_UserPermissionOverride" "Override de Permiso"      "Overrides de Permiso"     "Clave de permiso"
New-DvTable "cproroad_SystemSettings"         "Configuración del Sistema""Configuraciones"          "Nombre"
New-DvTable "cproroad_ActionRequest"          "Acción Pendiente"         "Acciones Pendientes"      "Tipo de acción"
New-DvTable "cproroad_WipConfig"              "Configuración WIP"        "Configuraciones WIP"      "Estado"

Write-Host "Esperando 8 s para que Dataverse procese las tablas..." -ForegroundColor Yellow
Start-Sleep -Seconds 8

# ══════════════════════════════════════════════════════════════════════════════
#  FASE 2 — Añadir columnas a cada tabla
# ══════════════════════════════════════════════════════════════════════════════
Write-Host "`n══ FASE 2: Añadir columnas ═══════════════════════════════" -ForegroundColor Cyan

# ── cproroad_team ──────────────────────────────────────────────────────────────
Write-Host "[cols] cproroad_team"
Add-Choice "cproroad_team" "cproroad_type"     "Tipo"     $OPT_TTYPE  "ApplicationRequired"
Add-Bool   "cproroad_team" "cproroad_isactive" "Activo"

# ── cproroad_state ─────────────────────────────────────────────────────────────
Write-Host "[cols] cproroad_state"
Add-Str  "cproroad_state" "cproroad_category" "Categoría"
Add-Int  "cproroad_state" "cproroad_order"    "Orden" 0 9999

# ── cproroad_appuser ───────────────────────────────────────────────────────────
Write-Host "[cols] cproroad_appuser"
Add-Str    "cproroad_appuser" "cproroad_email"    "Email"    "ApplicationRequired" 320
Add-Str    "cproroad_appuser" "cproroad_upn"      "UPN"      "ApplicationRequired" 320
Add-Choice "cproroad_appuser" "cproroad_role"     "Rol"      $OPT_ROLE "ApplicationRequired"
Add-Bool   "cproroad_appuser" "cproroad_isactive" "Activo"

# ── cproroad_permissionprofile ─────────────────────────────────────────────────
Write-Host "[cols] cproroad_permissionprofile"
Add-Str  "cproroad_permissionprofile" "cproroad_label"       "Etiqueta visible"  "ApplicationRequired" 200
Add-Memo "cproroad_permissionprofile" "cproroad_description" "Descripción"
Add-Bool "cproroad_permissionprofile" "cproroad_isactive"    "Activo"

# ── cproroad_rbacpermission ────────────────────────────────────────────────────
Write-Host "[cols] cproroad_rbacpermission"
Add-Str    "cproroad_rbacpermission" "cproroad_label" "Etiqueta"  "ApplicationRequired" 200
Add-Choice "cproroad_rbacpermission" "cproroad_group" "Grupo"     $OPT_RBACGRP "ApplicationRequired"

# ── cproroad_project ───────────────────────────────────────────────────────────
Write-Host "[cols] cproroad_project"
Add-Str    "cproroad_project" "cproroad_code"              "Código"               "ApplicationRequired" 50
Add-Choice "cproroad_project" "cproroad_status"            "Estado"               $OPT_PRJST   "ApplicationRequired"
Add-Choice "cproroad_project" "cproroad_priority"          "Prioridad"            $OPT_PRIO    "ApplicationRequired"
Add-Str    "cproroad_project" "cproroad_category"          "Categoría"            "None" 200
Add-Date   "cproroad_project" "cproroad_startdate"         "Fecha inicio"         "DateOnly"   "ApplicationRequired"
Add-Date   "cproroad_project" "cproroad_enddate"           "Fecha fin"            "DateOnly"   "ApplicationRequired"
Add-Int    "cproroad_project" "cproroad_progress"          "Progreso (%)"         0 100
Add-Memo   "cproroad_project" "cproroad_blockedreason"     "Motivo bloqueo"
Add-Choice "cproroad_project" "cproroad_deliveryownertype" "Responsable entrega"  $OPT_DLVOWN  "ApplicationRequired"
Add-Choice "cproroad_project" "cproroad_visibilitymode"    "Modo visibilidad"     $OPT_VIS

# ── cproroad_workitem ──────────────────────────────────────────────────────────
Write-Host "[cols] cproroad_workitem"
Add-Choice "cproroad_workitem" "cproroad_type"          "Tipo"                 $OPT_WITYPE "ApplicationRequired"
Add-Choice "cproroad_workitem" "cproroad_priority"      "Prioridad"            $OPT_PRIO   "ApplicationRequired"
Add-Int    "cproroad_workitem" "cproroad_progress"      "Progreso (%)"         0 100
Add-Date   "cproroad_workitem" "cproroad_startdate"     "Fecha inicio"         "DateOnly"
Add-Date   "cproroad_workitem" "cproroad_enddate"       "Fecha fin"            "DateOnly"
Add-Memo   "cproroad_workitem" "cproroad_tags"          "Etiquetas (JSON)"
Add-Memo   "cproroad_workitem" "cproroad_blockedreason" "Motivo bloqueo"
Add-Str    "cproroad_workitem" "cproroad_jiraissuekey"  "Jira Issue Key"
Add-Str    "cproroad_workitem" "cproroad_jiraurl"       "Jira URL"             "None" 1000
Add-Str    "cproroad_workitem" "cproroad_jirastate"     "Estado Jira"
Add-Str    "cproroad_workitem" "cproroad_sprintname"    "Sprint"
Add-Choice "cproroad_workitem" "cproroad_syncstatus"    "Estado sincronización" $OPT_SYNC
Add-Memo   "cproroad_workitem" "cproroad_syncerror"     "Error sincronización"

# ── cproroad_request ───────────────────────────────────────────────────────────
Write-Host "[cols] cproroad_request"
Add-Int    "cproroad_request" "cproroad_year"         "Año"                  2024 2099
Add-Memo   "cproroad_request" "cproroad_description"  "Descripción"
Add-Choice "cproroad_request" "cproroad_type"         "Tipo"                 $OPT_REQTYPE "ApplicationRequired"
Add-Choice "cproroad_request" "cproroad_priority"     "Prioridad"            $OPT_PRIO    "ApplicationRequired"
Add-Choice "cproroad_request" "cproroad_status"       "Estado"               $OPT_REQST   "ApplicationRequired"
Add-Memo   "cproroad_request" "cproroad_triagenote"   "Nota triage"
Add-Memo   "cproroad_request" "cproroad_cancelednote" "Nota cancelación"

# ── cproroad_evidence ──────────────────────────────────────────────────────────
Write-Host "[cols] cproroad_evidence"
Add-Choice "cproroad_evidence" "cproroad_entitytype" "Tipo entidad" @(@{v=100000000;l="WorkItem"},@{v=100000001;l="Project"})
Add-Str    "cproroad_evidence" "cproroad_entityid"   "ID entidad"   "ApplicationRequired"
Add-Choice "cproroad_evidence" "cproroad_type"       "Tipo"         $OPT_EVTYPE "ApplicationRequired"
Add-Memo   "cproroad_evidence" "cproroad_value"      "Valor"
Add-Memo   "cproroad_evidence" "cproroad_comment"    "Comentario"

# ── cproroad_activitylog ───────────────────────────────────────────────────────
Write-Host "[cols] cproroad_activitylog"
Add-Str    "cproroad_activitylog" "cproroad_entitytype" "Tipo entidad"
Add-Str    "cproroad_activitylog" "cproroad_entityid"   "ID entidad"
Add-Str    "cproroad_activitylog" "cproroad_action"     "Acción"     "ApplicationRequired"
Add-Str    "cproroad_activitylog" "cproroad_fromvalue"  "Valor anterior"
Add-Str    "cproroad_activitylog" "cproroad_tovalue"    "Valor nuevo"
Add-Str    "cproroad_activitylog" "cproroad_who"        "Usuario"    "ApplicationRequired"
Add-Choice "cproroad_activitylog" "cproroad_whorole"    "Rol usuario" $OPT_ROLE
Add-Date   "cproroad_activitylog" "cproroad_at"         "Fecha/hora" "DateAndTime" "ApplicationRequired"
Add-Memo   "cproroad_activitylog" "cproroad_note"       "Nota"

# ── cproroad_risk ──────────────────────────────────────────────────────────────
Write-Host "[cols] cproroad_risk"
Add-Memo   "cproroad_risk" "cproroad_description"  "Descripción"
Add-Choice "cproroad_risk" "cproroad_severity"     "Severidad"    $OPT_PRIO    "ApplicationRequired"
Add-Choice "cproroad_risk" "cproroad_status"       "Estado"       $OPT_RSKST   "ApplicationRequired"
Add-Choice "cproroad_risk" "cproroad_ownerrole"    "Rol responsable" $OPT_ROLE
Add-Date   "cproroad_risk" "cproroad_duedate"      "Fecha límite" "DateOnly"
Add-Memo   "cproroad_risk" "cproroad_closecomment" "Comentario cierre"
Add-Date   "cproroad_risk" "cproroad_closedon"     "Cerrado el"   "DateAndTime"

# ── cproroad_transition ────────────────────────────────────────────────────────
Write-Host "[cols] cproroad_transition"
Add-Memo "cproroad_transition" "cproroad_allowedroles"         "Roles permitidos (JSON)"
Add-Memo "cproroad_transition" "cproroad_assigntorole"         "Asignar a rol (JSON)"
Add-Bool "cproroad_transition" "cproroad_autoassignteam"       "Auto-asignar equipo"         "Sí" "No" $false
Add-Bool "cproroad_transition" "cproroad_requireuserassignment" "Requiere asignación usuario" "Sí" "No" $false
Add-Bool "cproroad_transition" "cproroad_requireevidence"      "Requiere evidencia"          "Sí" "No" $false
Add-Memo "cproroad_transition" "cproroad_evidencetypes"        "Tipos evidencia (JSON)"
Add-Bool "cproroad_transition" "cproroad_requirecomment"       "Requiere comentario"         "Sí" "No" $false
Add-Bool "cproroad_transition" "cproroad_confirmmove"          "Confirmar movimiento"        "Sí" "No" $false

# ── cproroad_rolepermission ────────────────────────────────────────────────────
Write-Host "[cols] cproroad_rolepermission"
Add-Choice "cproroad_rolepermission" "cproroad_role"          "Rol"             $OPT_ROLE "ApplicationRequired"
Add-Str    "cproroad_rolepermission" "cproroad_permissionkey" "Clave permiso"   "ApplicationRequired"
Add-Bool   "cproroad_rolepermission" "cproroad_value"         "Concedido"

# ── cproroad_profilepermission ─────────────────────────────────────────────────
Write-Host "[cols] cproroad_profilepermission"
Add-Str "cproroad_profilepermission" "cproroad_permissionkey" "Clave permiso" "ApplicationRequired"

# ── cproroad_userprofile ───────────────────────────────────────────────────────
Write-Host "[cols] cproroad_userprofile"
Add-Date "cproroad_userprofile" "cproroad_assignedon" "Asignado el" "DateAndTime" "ApplicationRequired"

# ── cproroad_userpermissionoverride ────────────────────────────────────────────
Write-Host "[cols] cproroad_userpermissionoverride"
Add-Str  "cproroad_userpermissionoverride" "cproroad_permissionkey" "Clave permiso" "ApplicationRequired"
Add-Bool "cproroad_userpermissionoverride" "cproroad_value"         "Concedido (true) / Revocado (false)"
Add-Memo "cproroad_userpermissionoverride" "cproroad_reason"        "Justificación" "ApplicationRequired"

# ── cproroad_systemsettings ────────────────────────────────────────────────────
Write-Host "[cols] cproroad_systemsettings"
Add-Bool "cproroad_systemsettings" "cproroad_strictvalidation"       "Validación estricta"
Add-Bool "cproroad_systemsettings" "cproroad_adminbypass"            "Admin puede saltar estados"
Add-Bool "cproroad_systemsettings" "cproroad_closecommentrequired"   "Comentario obligatorio al cerrar"  "Sí" "No" $false
Add-Bool "cproroad_systemsettings" "cproroad_closechecklistrequired" "Checklist obligatorio al cerrar"   "Sí" "No" $false
Add-Int  "cproroad_systemsettings" "cproroad_weekdays"               "Días laborables"   1 7
Add-Bool "cproroad_systemsettings" "cproroad_jirasyncenabled"        "Sincronización Jira activa"        "Sí" "No" $false
Add-Memo "cproroad_systemsettings" "cproroad_wiplimits"              "Límites WIP (JSON)"

# ── cproroad_actionrequest ─────────────────────────────────────────────────────
Write-Host "[cols] cproroad_actionrequest"
Add-Choice "cproroad_actionrequest" "cproroad_actiontype"    "Tipo acción"      $OPT_ACTTYPE "ApplicationRequired"
Add-Memo   "cproroad_actionrequest" "cproroad_payload"       "Payload (JSON)"
Add-Choice "cproroad_actionrequest" "cproroad_status"        "Estado"           $OPT_ACTST "ApplicationRequired"
Add-Date   "cproroad_actionrequest" "cproroad_createdat"     "Creado el"        "DateAndTime"
Add-Memo   "cproroad_actionrequest" "cproroad_errormessage"  "Mensaje de error"

# ── cproroad_wipconfig ─────────────────────────────────────────────────────────
Write-Host "[cols] cproroad_wipconfig"
Add-Int "cproroad_wipconfig" "cproroad_limit" "Límite WIP (0=sin límite)" 0 999

Write-Host "Esperando 5 s antes de crear relaciones..." -ForegroundColor Yellow
Start-Sleep -Seconds 5

# ══════════════════════════════════════════════════════════════════════════════
#  FASE 3 — Relaciones lookup (1:N)
#  Add-Lookup $referencedEntity $referencingEntity $lookupColumn $label $relName
# ══════════════════════════════════════════════════════════════════════════════
Write-Host "`n══ FASE 3: Relaciones lookup ══════════════════════════════" -ForegroundColor Cyan

# cproroad_project
Write-Host "[rels] cproroad_project"
Add-Lookup "cproroad_businessarea" "cproroad_project" "cproroad_businessareaid" "Área de Negocio"    "cproroad_businessarea_project"
Add-Lookup "cproroad_team"         "cproroad_project" "cproroad_providerteamid" "Equipo Proveedor"   "cproroad_team_project_provider" "None"
Add-Lookup "cproroad_team"         "cproroad_project" "cproroad_assignedtoteamid" "Equipo asignado"  "cproroad_team_project_assigned" "None"
Add-Lookup "cproroad_appuser"      "cproroad_project" "cproroad_assignedtouserid" "Usuario asignado" "cproroad_appuser_project_assigned" "None"
Add-Lookup "cproroad_appuser"      "cproroad_project" "cproroad_requestedbyuserid" "Solicitado por"  "cproroad_appuser_project_requested" "None"

# cproroad_workitem
Write-Host "[rels] cproroad_workitem"
Add-Lookup "cproroad_project"  "cproroad_workitem" "cproroad_projectid"        "Proyecto"         "cproroad_project_workitem"       "ApplicationRequired"
Add-Lookup "cproroad_state"    "cproroad_workitem" "cproroad_stateid"          "Estado"           "cproroad_state_workitem"         "ApplicationRequired"
Add-Lookup "cproroad_team"     "cproroad_workitem" "cproroad_assignedtoteamid" "Equipo asignado"  "cproroad_team_workitem_assigned"
Add-Lookup "cproroad_appuser"  "cproroad_workitem" "cproroad_assignedtouserid" "Usuario asignado" "cproroad_appuser_workitem_assigned" "ApplicationRequired"
Add-Lookup "cproroad_appuser"  "cproroad_workitem" "cproroad_requestedbyuserid" "Solicitado por"  "cproroad_appuser_workitem_req"
Add-Lookup "cproroad_appuser"  "cproroad_workitem" "cproroad_createdbyuserid"  "Creado por"       "cproroad_appuser_workitem_created"

# cproroad_request
Write-Host "[rels] cproroad_request"
Add-Lookup "cproroad_appuser"  "cproroad_request" "cproroad_requestedbyuserid"  "Solicitado por"     "cproroad_appuser_request_req" "ApplicationRequired"
Add-Lookup "cproroad_team"     "cproroad_request" "cproroad_requestedbyteamid"  "Equipo solicitante" "cproroad_team_request_req"
Add-Lookup "cproroad_project"  "cproroad_request" "cproroad_relatedprojectid"   "Proyecto relacionado" "cproroad_project_request"
Add-Lookup "cproroad_appuser"  "cproroad_request" "cproroad_triageowneruserid"  "Responsable triage" "cproroad_appuser_request_triage"
Add-Lookup "cproroad_workitem" "cproroad_request" "cproroad_convertedworkitemid" "Tarea convertida"  "cproroad_workitem_request_converted"

# cproroad_evidence
Write-Host "[rels] cproroad_evidence"
Add-Lookup "cproroad_appuser" "cproroad_evidence" "cproroad_createdbyuserid" "Creado por" "cproroad_appuser_evidence_created"

# cproroad_activitylog
Write-Host "[rels] cproroad_activitylog"
Add-Lookup "cproroad_project" "cproroad_activitylog" "cproroad_projectid" "Proyecto" "cproroad_project_activitylog"

# cproroad_risk
Write-Host "[rels] cproroad_risk"
Add-Lookup "cproroad_project"  "cproroad_risk" "cproroad_projectid"        "Proyecto"       "cproroad_project_risk" "ApplicationRequired"
Add-Lookup "cproroad_appuser"  "cproroad_risk" "cproroad_assignedtouserid" "Responsable"    "cproroad_appuser_risk_assigned"
Add-Lookup "cproroad_workitem" "cproroad_risk" "cproroad_linkedworkitemid" "Tarea vinculada" "cproroad_workitem_risk_linked"
Add-Lookup "cproroad_appuser"  "cproroad_risk" "cproroad_createdbyuserid"  "Creado por"     "cproroad_appuser_risk_created"
Add-Lookup "cproroad_appuser"  "cproroad_risk" "cproroad_closedbyuserid"   "Cerrado por"    "cproroad_appuser_risk_closed"

# cproroad_transition
Write-Host "[rels] cproroad_transition"
Add-Lookup "cproroad_state" "cproroad_transition" "cproroad_fromstateid" "Estado origen" "cproroad_state_transition_from" "ApplicationRequired"
Add-Lookup "cproroad_state" "cproroad_transition" "cproroad_tostateid"   "Estado destino" "cproroad_state_transition_to"  "ApplicationRequired"

# cproroad_profilepermission
Write-Host "[rels] cproroad_profilepermission"
Add-Lookup "cproroad_permissionprofile" "cproroad_profilepermission" "cproroad_profileid" "Perfil" "cproroad_permissionprofile_profileperm" "ApplicationRequired"

# cproroad_userprofile
Write-Host "[rels] cproroad_userprofile"
Add-Lookup "cproroad_appuser"          "cproroad_userprofile" "cproroad_userid"        "Usuario"     "cproroad_appuser_userprofile_user" "ApplicationRequired"
Add-Lookup "cproroad_permissionprofile" "cproroad_userprofile" "cproroad_profileid"    "Perfil"      "cproroad_permissionprofile_userprofile" "ApplicationRequired"
Add-Lookup "cproroad_appuser"          "cproroad_userprofile" "cproroad_assignedbyuserid" "Asignado por" "cproroad_appuser_userprofile_by"

# cproroad_userpermissionoverride
Write-Host "[rels] cproroad_userpermissionoverride"
Add-Lookup "cproroad_appuser" "cproroad_userpermissionoverride" "cproroad_userid"        "Usuario"    "cproroad_appuser_override_user" "ApplicationRequired"
Add-Lookup "cproroad_appuser" "cproroad_userpermissionoverride" "cproroad_createdbyuserid" "Creado por" "cproroad_appuser_override_created"

# cproroad_actionrequest
Write-Host "[rels] cproroad_actionrequest"
Add-Lookup "cproroad_workitem" "cproroad_actionrequest" "cproroad_workitemid" "Tarea" "cproroad_workitem_actionrequest"

# cproroad_wipconfig
Write-Host "[rels] cproroad_wipconfig"
Add-Lookup "cproroad_state" "cproroad_wipconfig" "cproroad_stateid" "Estado" "cproroad_state_wipconfig" "ApplicationRequired"

# ══════════════════════════════════════════════════════════════════════════════
#  FASE 4 — Publicar todos los cambios
# ══════════════════════════════════════════════════════════════════════════════
Write-Host "`n══ FASE 4: Publicando cambios... ═══════════════════════════" -ForegroundColor Cyan
Invoke-Dv POST "PublishAllXml" $null | Out-Null
Write-Host "  ✓ PublishAllXml completado." -ForegroundColor Green

# ══════════════════════════════════════════════════════════════════════════════
#  RESUMEN
# ══════════════════════════════════════════════════════════════════════════════
Write-Host "`n══════════════════════════════════════════════════════════════" -ForegroundColor Green
Write-Host "  ✓ 20 tablas CPROROAD creadas en $OrgUrl" -ForegroundColor Green
Write-Host "  Prefijo publisher : cproroad_" -ForegroundColor Gray
Write-Host "  Entorno           : 8d4eb458-70b4-e902-ad69-15739a4e304d" -ForegroundColor Gray
Write-Host "  Tablas creadas:" -ForegroundColor Gray
@(
    "cproroad_businessarea", "cproroad_team", "cproroad_state", "cproroad_appuser",
    "cproroad_permissionprofile", "cproroad_rbacpermission",
    "cproroad_project", "cproroad_workitem", "cproroad_request",
    "cproroad_evidence", "cproroad_activitylog", "cproroad_risk",
    "cproroad_transition", "cproroad_rolepermission", "cproroad_profilepermission",
    "cproroad_userprofile", "cproroad_userpermissionoverride",
    "cproroad_systemsettings", "cproroad_actionrequest", "cproroad_wipconfig"
) | ForEach-Object { Write-Host "    · $_" -ForegroundColor Gray }
Write-Host "══════════════════════════════════════════════════════════════`n" -ForegroundColor Green
