#Requires -Version 5.1
<#
.SYNOPSIS
  Inserta perfiles de permisos de ejemplo en Dataverse DEV.

.DESCRIPTION
  Tablas que rellena:
    cproroad_permissionprofile   → 3 perfiles de ejemplo
    cproroad_profilepermission   → permisos asignados a cada perfil

  Entorno DEV : 8d4eb458-70b4-e902-ad69-15739a4e304d
  Org URL     : https://org4e3f8413.crm4.dynamics.com

.NOTES
  Ejecutar solo si la pantalla "Perfiles de Permisos" aparece vacía.
  No verifica duplicados: borrar perfiles previos antes de re-ejecutar.
#>
param(
    [string]$OrgUrl   = "https://org4e3f8413.crm4.dynamics.com",
    [string]$ClientId = "1950a258-227b-4e31-a9cf-717495945fc2"
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
            Write-Host "  [ERROR] $errBody" -ForegroundColor Red
        }
        throw
    }
}

function Progress([string]$section, [int]$i, [int]$total, [string]$name) {
    Write-Host ("  [{0}/{1}] {2} — {3}" -f $i, $total, $section, $name) -ForegroundColor Gray
}

# ============================================================================
# 1. PERMISSION PROFILES
# ============================================================================
Write-Host "=== 1. Permission Profiles ===" -ForegroundColor Cyan

$profiles_data = @(
    @{
        name        = "Project-Owner-Extra"
        label       = "Project Owner Extra"
        description = "Acceso ampliado para gestores de proyecto: ver todas las tareas, editar y cerrar."
        isActive    = $true
        permissions = @(
            "TASK_VIEW_ALL",
            "TASK_CREATE",
            "TASK_EDIT",
            "TASK_CLOSE",
            "VIEW_REPORTS",
            "VIEW_RISKS"
        )
    },
    @{
        name        = "Key-User"
        label       = "Key User"
        description = "Usuario clave con acceso extendido a vistas de gobierno y planificación."
        isActive    = $true
        permissions = @(
            "VIEW_ROADMAP",
            "VIEW_GANTT",
            "VIEW_REPORTS",
            "VIEW_RISKS",
            "VIEW_AUDIT",
            "VIEW_HOME_SMART",
            "TASK_VIEW_ALL"
        )
    },
    @{
        name        = "Reporting-Access"
        label       = "Acceso a Informes"
        description = "Perfil de solo lectura ampliado: permite acceder a informes, roadmap y gantt sin edición."
        isActive    = $true
        permissions = @(
            "VIEW_ROADMAP",
            "VIEW_GANTT",
            "VIEW_REPORTS",
            "VIEW_HOME_SMART"
        )
    }
)

$profileGuids = @{}
$i = 0
foreach ($p in $profiles_data) {
    $i++
    Progress "Profile" $i $profiles_data.Count $p.label
    $guid = DvPostReturnId "cproroad_permissionprofiles" @{
        cproroad_name        = $p.name
        cproroad_label       = $p.label
        cproroad_description = $p.description
        cproroad_isactive    = $p.isActive
    }
    $profileGuids[$p.name] = $guid
    Write-Host "       GUID: $guid" -ForegroundColor DarkGray
}
Write-Host "  -> $i perfiles creados`n" -ForegroundColor Green

# ============================================================================
# 2. PROFILE PERMISSIONS
# ============================================================================
Write-Host "=== 2. Profile Permissions ===" -ForegroundColor Cyan

$totalPP = 0
foreach ($p in $profiles_data) {
    $profileGuid = $profileGuids[$p.name]
    if (-not $profileGuid) {
        Write-Host "  [SKIP] No se obtuvo GUID para el perfil '$($p.name)'" -ForegroundColor Yellow
        continue
    }
    foreach ($permKey in $p.permissions) {
        $totalPP++
        Write-Host ("  [{0}] {1} → {2}" -f $totalPP, $p.label, $permKey) -ForegroundColor Gray
        DvPostReturnId "cproroad_profilepermissions" @{
            cproroad_name         = "$($p.name)-$permKey"
            cproroad_permissionkey = $permKey
            "cproroad_profileid@odata.bind" = "/cproroad_permissionprofiles($profileGuid)"
        } | Out-Null
    }
}
Write-Host "  -> $totalPP entradas de perfil-permiso creadas`n" -ForegroundColor Green

Write-Host "=== DONE ===" -ForegroundColor Green
Write-Host "Se crearon $($profiles_data.Count) perfiles con $totalPP permisos totales." -ForegroundColor Cyan
