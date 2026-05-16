#Requires -Version 5.1
<#
.SYNOPSIS
  Añade la columna cproroad_teamids (texto JSON) a cproroad_appuser en Dataverse.

.DESCRIPTION
  Operación única de cambio de esquema.  El campo almacena un array JSON de IDs
  de equipo (GUIDs), p.ej. '["guid1","guid2"]'.

  Una vez ejecutado, el campo queda disponible en la tabla y el bridge puede
  leerlo/escribirlo para persistir la pertenencia de un usuario a varios equipos.

  Entorno DEV : 8d4eb458-70b4-e902-ad69-15739a4e304d
  Org URL     : https://org4e3f8413.crm4.dynamics.com

.NOTES
  Si el atributo ya existe, Dataverse devuelve HTTP 400 y el script lo notifica
  (no es un error fatal: simplemente ya estaba creado).
  Ejecutar una sola vez por entorno.
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
# Helper: crear columna de texto
# ────────────────────────────────────────────────────────────────────────────
function Add-StringColumn {
    param(
        [string]$Entity,
        [string]$SchemaName,
        [string]$DisplayLabel,
        [int]$MaxLength = 2000
    )

    $body = @{
        "@odata.type"       = "Microsoft.Dynamics.CRM.StringAttributeMetadata"
        "SchemaName"        = $SchemaName
        "AttributeType"     = "String"
        "AttributeTypeName" = @{ "Value" = "StringType" }
        "MaxLength"         = $MaxLength
        "Format"            = "Text"
        "DisplayName"       = @{
            "@odata.type" = "Microsoft.Dynamics.CRM.Label"
            "LocalizedLabels" = @(
                @{
                    "@odata.type"   = "Microsoft.Dynamics.CRM.LocalizedLabel"
                    "Label"         = $DisplayLabel
                    "LanguageCode"  = 3082
                    "IsManaged"     = $false
                }
            )
        }
        "RequiredLevel"     = @{
            "@odata.type" = "Microsoft.Dynamics.CRM.AttributeRequiredLevelManagedProperty"
            "Value"       = "None"
            "CanBeChanged"= $true
            "ManagedPropertyLogicalName" = "canmodifyrequirementlevelsettings"
        }
    }

    $url  = "$apiBase/EntityDefinitions(LogicalName='$Entity')/Attributes"
    $json = $body | ConvertTo-Json -Depth 10 -Compress

    try {
        $resp = Invoke-WebRequest -Uri $url -Method Post -Headers $hdr `
                                  -Body $json -ContentType "application/json; charset=utf-8"
        Write-Host "  [OK] Columna '$SchemaName' creada en '$Entity'." -ForegroundColor Green
        return $resp
    } catch {
        $statusCode = $_.Exception.Response.StatusCode.value__
        $errStream  = $_.Exception.Response.GetResponseStream()
        if ($errStream) {
            $reader  = New-Object System.IO.StreamReader($errStream)
            $errBody = $reader.ReadToEnd()
            if ($statusCode -eq 400 -and $errBody -match "duplicate") {
                Write-Host "  [SKIP] La columna '$SchemaName' ya existe en '$Entity'. Sin cambios." -ForegroundColor Yellow
            } else {
                Write-Host "  [ERROR] HTTP $statusCode — $errBody" -ForegroundColor Red
                throw
            }
        } else {
            throw
        }
    }
}

# ────────────────────────────────────────────────────────────────────────────
# 2. Añadir columna cproroad_TeamIds a cproroad_appuser
# ────────────────────────────────────────────────────────────────────────────
Write-Host "=== Añadiendo columna cproroad_TeamIds a cproroad_appuser ===" -ForegroundColor Cyan

Add-StringColumn `
    -Entity       "cproroad_appuser" `
    -SchemaName   "cproroad_TeamIds" `
    -DisplayLabel "Team IDs (JSON)" `
    -MaxLength    2000

# ────────────────────────────────────────────────────────────────────────────
# 3. Publicar cambios de entidad
# ────────────────────────────────────────────────────────────────────────────
Write-Host "`n=== Publicando cambios de personalización ===" -ForegroundColor Cyan

$pubBody = @{
    "ParameterXml" = "<importexportxml><entities><entity>cproroad_appuser</entity></entities></importexportxml>"
}
$pubJson = $pubBody | ConvertTo-Json -Depth 3 -Compress

try {
    Invoke-RestMethod -Uri "$apiBase/PublishXml" `
                      -Method Post -Headers $hdr `
                      -Body $pubJson -ContentType "application/json; charset=utf-8" | Out-Null
    Write-Host "  [OK] Publicación completada." -ForegroundColor Green
} catch {
    Write-Host "  [WARN] Publish retornó un aviso (puede ser inofensivo): $_" -ForegroundColor Yellow
}

Write-Host "`n[DONE] Esquema actualizado. Ejecuta 'pac code push' para redesplegar la app." -ForegroundColor Green
Write-Host "       Los usuarios existentes tendrán cproroad_teamids = null hasta que se actualicen." -ForegroundColor Gray
