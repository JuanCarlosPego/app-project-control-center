#Requires -Version 5.1
<#
.SYNOPSIS
  Inserta (o restaura) las transiciones maestras de la Máquina de Estados
  en Dataverse. Idempotente: detecta duplicados por nombre y los omite.

.DESCRIPTION
  Tablas que gestiona:
    cproroad_state      → SOLO lectura para obtener GUIDs por nombre
    cproroad_transition → Inserta las transiciones por defecto si no existen

  Grafo por defecto (8 transiciones):
    Nuevo              → Refinamiento        (Admin, IT AirEuropa)
    Refinamiento       → En curso            (Admin, IT AirEuropa)
    En curso           → Listo para pruebas  (Admin, Proveedor)
    Listo para pruebas → En pruebas          (Admin, IT AirEuropa)
    En pruebas         → Aceptado            (Admin, IT AirEuropa, Usuario)
    Aceptado           → Cerrado             (Admin, IT AirEuropa)  ← ruta al terminal
    En curso           → Bloqueado           (Admin, IT AirEuropa, Proveedor)
    Bloqueado          → En curso            (Admin, IT AirEuropa)

  Uso típico:
    .\Seed-Transitions.ps1
    .\Seed-Transitions.ps1 -OrgUrl "https://orgXXXXX.crm4.dynamics.com"
    .\Seed-Transitions.ps1 -Force   # borra todas las transiciones y recrea

.PARAMETER OrgUrl
  URL raíz de la organización de Dataverse (sin barra final).

.PARAMETER ClientId
  App ID para MSAL device-code. Por defecto el de PAC CLI público.

.PARAMETER Force
  Si se especifica, elimina TODAS las transiciones existentes antes de
  insertar las de fábrica. Usar con precaución en entornos con datos reales.

.NOTES
  Entorno DEV : 8d4eb458-70b4-e902-ad69-15739a4e304d
  Org URL DEV : https://org4e3f8413.crm4.dynamics.com
  Publisher   : cproroad_

  Requisitos:
    - PowerShell 5.1 o superior
    - Módulo MSAL.PS (se instala automáticamente si no está presente)
    - Acceso de System Administrator o equivalente en el entorno destino
#>
param(
    [string]$OrgUrl   = "https://org4e3f8413.crm4.dynamics.com",
    [string]$ClientId = "1950a258-227b-4e31-a9cf-717495945fc2",  # PAC CLI public app
    [switch]$Force
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"
$ProgressPreference    = "SilentlyContinue"

# ════════════════════════════════════════════════════════════════════════════
# 0. MSAL.PS
# ════════════════════════════════════════════════════════════════════════════
if (-not (Get-Module -Name MSAL.PS -ListAvailable)) {
    Write-Host "[SETUP] Instalando MSAL.PS..." -ForegroundColor Cyan
    Install-Module -Name MSAL.PS -Scope CurrentUser -Force -AllowClobber
}
Import-Module MSAL.PS -Force -ErrorAction Stop

# ════════════════════════════════════════════════════════════════════════════
# 1. Autenticación (device-code)
# ════════════════════════════════════════════════════════════════════════════
function Get-TenantId([string]$domain) {
    try {
        $r = Invoke-RestMethod "https://login.microsoftonline.com/$domain/.well-known/openid-configuration"
        if ($r.issuer -match '([0-9a-f-]{36})') { return $Matches[1] }
    } catch {}
    return "common"
}

$tenantId = Get-TenantId "globalia.com"
$resource = $OrgUrl.TrimEnd('/') + "/"

Write-Host "[AUTH] Iniciando device-code para $OrgUrl ..." -ForegroundColor Cyan
Write-Host "       Abre https://microsoft.com/devicelogin con el código que aparezca." -ForegroundColor Yellow

$tokenParams = @{
    ClientId  = $ClientId
    TenantId  = $tenantId
    Scopes    = @("${resource}.default")
    DeviceCode = $true
}
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

# ════════════════════════════════════════════════════════════════════════════
# 2. Helpers
# ════════════════════════════════════════════════════════════════════════════
function DvGet([string]$relUrl) {
    return Invoke-RestMethod -Uri "$apiBase/$relUrl" -Headers $hdr -Method Get
}

function DvPostReturnId([string]$entity, [hashtable]$body) {
    $url  = "$apiBase/$entity"
    $json = $body | ConvertTo-Json -Depth 5 -Compress
    try {
        $resp = Invoke-WebRequest -Uri $url -Method Post -Headers $hdr `
                                  -Body $json -ContentType "application/json; charset=utf-8"
        $eid = $resp.Headers["OData-EntityId"]
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

function DvDelete([string]$entity, [string]$guid) {
    Invoke-RestMethod -Uri "$apiBase/$entity($guid)" -Headers $hdr -Method Delete | Out-Null
}

# ════════════════════════════════════════════════════════════════════════════
# 3. Obtener GUIDs de estados por nombre
# ════════════════════════════════════════════════════════════════════════════
Write-Host "=== Leyendo estados existentes en Dataverse ===" -ForegroundColor Cyan
$statesResp = DvGet "cproroad_states?`$select=cproroad_stateid,cproroad_name"
$stateGuid  = @{}
foreach ($s in $statesResp.value) {
    $stateGuid[$s.cproroad_name] = $s.cproroad_stateid
    Write-Host ("  '{0}' = {1}" -f $s.cproroad_name, $s.cproroad_stateid) -ForegroundColor DarkGray
}

$required = @("Nuevo","Refinamiento","En curso","Listo para pruebas","En pruebas","Aceptado","Cerrado","Bloqueado")
$missing  = $required | Where-Object { -not $stateGuid.ContainsKey($_) }
if ($missing.Count -gt 0) {
    Write-Host "`n[ERROR] Los siguientes estados NO existen en Dataverse:" -ForegroundColor Red
    $missing | ForEach-Object { Write-Host "  - $_" -ForegroundColor Red }
    Write-Host "  Ejecuta primero Seed-AdminData.ps1 para crear los estados." -ForegroundColor Yellow
    exit 1
}
Write-Host "  -> $($stateGuid.Count) estados encontrados.`n" -ForegroundColor Green

# ════════════════════════════════════════════════════════════════════════════
# 4. Definición del grafo de transiciones maestras
# ════════════════════════════════════════════════════════════════════════════
#
# Estructura:
#   from         — nombre del estado origen
#   to           — nombre del estado destino
#   allowed      — roles que pueden ejecutar la transición
#   assignTo     — roles a los que se asigna el ítem tras la transición
#   autoTeam     — asignación automática de equipo
#   reqUser      — requiere asignación de usuario
#   reqEvid      — requiere adjuntar evidencia
#   evTypes      — tipos de evidencia aceptados (link | comment | file)
#   reqComment   — requiere comentario obligatorio
#   confirm      — requiere confirmación de usuario antes de mover
#
$transitionsMaster = @(
    # ── Flujo principal (happy path hacia Cerrado) ──────────────────────────
    @{
        from="Nuevo"; to="Refinamiento"
        allowed  = @("Admin","IT AirEuropa")
        assignTo = @("IT AirEuropa")
        autoTeam=$true;  reqUser=$false; reqEvid=$false
        evTypes=@(); reqComment=$false; confirm=$false
    },
    @{
        from="Refinamiento"; to="En curso"
        allowed  = @("Admin","IT AirEuropa")
        assignTo = @("Proveedor")
        autoTeam=$true;  reqUser=$true;  reqEvid=$false
        evTypes=@(); reqComment=$false; confirm=$false
    },
    @{
        from="En curso"; to="Listo para pruebas"
        allowed  = @("Admin","Proveedor")
        assignTo = @("IT AirEuropa")
        autoTeam=$true;  reqUser=$true;  reqEvid=$true
        evTypes=@("link","comment","file"); reqComment=$false; confirm=$false
    },
    @{
        from="Listo para pruebas"; to="En pruebas"
        allowed  = @("Admin","IT AirEuropa")
        assignTo = @("Usuario")
        autoTeam=$true;  reqUser=$true;  reqEvid=$false
        evTypes=@(); reqComment=$false; confirm=$false
    },
    @{
        from="En pruebas"; to="Aceptado"
        allowed  = @("Admin","IT AirEuropa","Usuario")
        assignTo = @("IT AirEuropa")
        autoTeam=$true;  reqUser=$false; reqEvid=$true
        evTypes=@("comment"); reqComment=$false; confirm=$false
    },
    @{
        from="Aceptado"; to="Cerrado"
        allowed  = @("Admin","IT AirEuropa")
        assignTo = @("IT AirEuropa")
        autoTeam=$true;  reqUser=$false; reqEvid=$false
        evTypes=@(); reqComment=$true; confirm=$true
    },
    # ── Rutas de bloqueo / reactivación ─────────────────────────────────────
    @{
        from="En curso"; to="Bloqueado"
        allowed  = @("Admin","IT AirEuropa","Proveedor")
        assignTo = @("IT AirEuropa")
        autoTeam=$true;  reqUser=$false; reqEvid=$false
        evTypes=@(); reqComment=$true; confirm=$false
    },
    @{
        from="Bloqueado"; to="En curso"
        allowed  = @("Admin","IT AirEuropa")
        assignTo = @("Proveedor")
        autoTeam=$true;  reqUser=$true;  reqEvid=$false
        evTypes=@(); reqComment=$false; confirm=$false
    }
)

# ════════════════════════════════════════════════════════════════════════════
# 5. Modo -Force: borrar todas las transiciones actuales
# ════════════════════════════════════════════════════════════════════════════
if ($Force) {
    Write-Host "=== -Force: eliminando transiciones existentes ===" -ForegroundColor Yellow
    $existingTr = DvGet "cproroad_transitions?`$select=cproroad_transitionid,cproroad_name"
    $nDel = 0
    foreach ($tr in $existingTr.value) {
        Write-Host ("  Eliminando '{0}' ..." -f $tr.cproroad_name) -ForegroundColor DarkGray
        DvDelete "cproroad_transitions" $tr.cproroad_transitionid
        $nDel++
    }
    Write-Host "  -> $nDel transiciones eliminadas.`n" -ForegroundColor Green
}

# ════════════════════════════════════════════════════════════════════════════
# 6. Obtener transiciones ya existentes (para deduplicar por nombre)
# ════════════════════════════════════════════════════════════════════════════
Write-Host "=== Leyendo transiciones existentes ===" -ForegroundColor Cyan
$existingTrResp  = DvGet "cproroad_transitions?`$select=cproroad_transitionid,cproroad_name"
$existingByName  = @{}
foreach ($tr in $existingTrResp.value) {
    $existingByName[$tr.cproroad_name] = $tr.cproroad_transitionid
}
Write-Host ("  -> {0} transiciones ya presentes en Dataverse.`n" -f $existingByName.Count) -ForegroundColor Green

# ════════════════════════════════════════════════════════════════════════════
# 7. Insertar las que faltan
# ════════════════════════════════════════════════════════════════════════════
Write-Host "=== Insertando transiciones maestras ===" -ForegroundColor Cyan

$inserted = 0
$skipped  = 0
$failed   = 0
$i        = 0

foreach ($tr in $transitionsMaster) {
    $i++
    $label = "$($tr.from) -> $($tr.to)"

    if ($existingByName.ContainsKey($label)) {
        Write-Host ("  [{0}/{1}] SKIP  — '{2}' ya existe." -f $i, $transitionsMaster.Count, $label) -ForegroundColor DarkGray
        $skipped++
        continue
    }

    $fromGuid = $stateGuid[$tr.from]
    $toGuid   = $stateGuid[$tr.to]
    if (-not $fromGuid -or -not $toGuid) {
        Write-Host ("  [{0}/{1}] ERROR — '{2}': estado origen o destino sin GUID." -f $i, $transitionsMaster.Count, $label) -ForegroundColor Red
        $failed++
        continue
    }

    $body = @{
        cproroad_name                           = $label
        cproroad_allowedroles                   = ($tr.allowed  | ConvertTo-Json -Compress)
        cproroad_assigntorole                   = ($tr.assignTo | ConvertTo-Json -Compress)
        cproroad_autoassignteam                 = $tr.autoTeam
        cproroad_requireuserassignment          = $tr.reqUser
        cproroad_requireevidence                = $tr.reqEvid
        cproroad_evidencetypes                  = ($tr.evTypes  | ConvertTo-Json -Compress)
        cproroad_requirecomment                 = $tr.reqComment
        cproroad_confirmmove                    = $tr.confirm
        "cproroad_fromstateid@odata.bind"       = "/cproroad_states($fromGuid)"
        "cproroad_tostateid@odata.bind"         = "/cproroad_states($toGuid)"
    }

    try {
        $newId = DvPostReturnId "cproroad_transitions" $body
        Write-Host ("  [{0}/{1}] OK    — '{2}' ({3})" -f $i, $transitionsMaster.Count, $label, $newId) -ForegroundColor Green
        $inserted++
    } catch {
        Write-Host ("  [{0}/{1}] ERROR — '{2}': {3}" -f $i, $transitionsMaster.Count, $label, $_.Exception.Message) -ForegroundColor Red
        $failed++
    }
}

# ════════════════════════════════════════════════════════════════════════════
# 8. Resumen
# ════════════════════════════════════════════════════════════════════════════
Write-Host ""
Write-Host "══════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "  Resultado:" -ForegroundColor Cyan
Write-Host ("    Insertadas : {0}" -f $inserted) -ForegroundColor Green
Write-Host ("    Omitidas   : {0} (ya existían)" -f $skipped) -ForegroundColor DarkGray
Write-Host ("    Errores    : {0}" -f $failed) -ForegroundColor $(if ($failed -gt 0) { "Red" } else { "DarkGray" })
Write-Host "══════════════════════════════════════════" -ForegroundColor Cyan

if ($failed -gt 0) { exit 1 } else { exit 0 }
