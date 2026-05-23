// ─────────────────────────────────────────────────────────────────────────────
//  src/services/dataverseSdk.ts
//
//  Capa de acceso a Dataverse via @microsoft/power-apps/data SDK.
//
//  CÓMO FUNCIONA:
//    El SDK usa window.powerAppsBridge (postMessage con el frame padre de
//    Power Apps). El runtime de Canvas App ya tiene el token del usuario y
//    lo pasa de forma transparente — sin MSAL ni popup.
//
//  REGLAS:
//    1. IS_LOCAL = (VITE_USE_MOCKS === 'true')  ← fuente única de verdad
//       - true  → LOCAL (.env)         → mocks MSW — este archivo NO se invoca
//       - false → cualquier build      → Dataverse real (DEV / TEST / PROD)
//
//    2. Cola de escrituras (_writeQueue): serializa create/update/delete.
//
//    3. Las OData strings de dataverseBridge.ts se parsean a IOperationOptions.
//       Soportado: $select, $filter, $orderby, $top, $skip.
// ─────────────────────────────────────────────────────────────────────────────

import { getClient } from "@microsoft/power-apps/data";
import type { IOperationOptions } from "@microsoft/power-apps/data";
export { ALL_TABLES_DSI } from "./tableRegistry";

/**
 * True SOLO cuando VITE_USE_MOCKS=true (.env LOCAL).
 * En cualquier build (DEV / TEST / PROD) es false → Dataverse real.
 * Fuente única de verdad: .env → VITE_USE_MOCKS=true
 *                         .env.production → VITE_USE_MOCKS=false
 */
export const IS_LOCAL: boolean = import.meta.env.VITE_USE_MOCKS === 'true';

// ── Importar mapa de tablas ───────────────────────────────────────────────────
import { ALL_TABLES_DSI as _TABLES } from "./tableRegistry";

// ── DataSourcesInfo para getClient() ─────────────────────────────────────────
// El SDK necesita un mapa entitySetName → { tableId, dataSourceType, apis }
const DATA_SOURCES_INFO = Object.fromEntries(
  Object.values(_TABLES).map((t) => [
    t.entitySetName,
    { tableId: t.entitySetName, dataSourceType: "Dataverse", apis: {} },
  ]),
);

// ── Mapa logicalName → entitySetName ─────────────────────────────────────────
// dataverseBridge.ts pasa logicalName (ej: "cproroad_appuser");
// el SDK espera entitySetName (ej: "cproroad_appusers").
const LOGICAL_TO_SET: Record<string, string> = Object.fromEntries(
  Object.values(_TABLES).map((t) => [t.logicalName, t.entitySetName]),
);

function toEntitySet(name: string): string {
  return LOGICAL_TO_SET[name] ?? name;
}

// ── Mapa logicalName → campo PK ───────────────────────────────────────────────
// Dataverse: la PK de una entidad custom es siempre `{logicalName}id`.
function pkField(logicalName: string): string {
  return `${logicalName}id`;
}

// ── Cliente SDK (singleton) ───────────────────────────────────────────────────
let _sdkClient: ReturnType<typeof getClient> | null = null;

function getSdkClient(): ReturnType<typeof getClient> {
  if (!_sdkClient) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    _sdkClient = getClient(DATA_SOURCES_INFO);
  }
  return _sdkClient;
}

// ── Parser OData string → IOperationOptions ───────────────────────────────────
// Soporta: ?$select=a,b&$filter=x eq 1&$orderby=name asc&$top=50&$skip=0
function parseOData(odataStr?: string): IOperationOptions {
  if (!odataStr) return {};
  const str = odataStr.startsWith("?") ? odataStr.slice(1) : odataStr;
  const opts: IOperationOptions = {};
  // Dividir por & — los valores de $filter no usan & (son expresiones OData)
  for (const part of str.split("&")) {
    const eqIdx = part.indexOf("=");
    if (eqIdx === -1) continue;
    const key = part.slice(0, eqIdx).trim();
    const val = part.slice(eqIdx + 1).trim();
    if      (key === "$select")  opts.select  = val.split(",").map((s) => s.trim()).filter(Boolean);
    else if (key === "$filter")  opts.filter  = val;
    else if (key === "$orderby") opts.orderBy = val.split(",").map((s) => s.trim()).filter(Boolean);
    else if (key === "$top")     opts.top     = parseInt(val, 10);
    else if (key === "$skip")    opts.skip    = parseInt(val, 10);
    else if (key === "$count")   opts.count   = val === "true";
  }
  return opts;
}

// ── Tipos de retorno ──────────────────────────────────────────────────────────
type DvRecord     = Record<string, unknown>;
type DvResult     = { entities: DvRecord[] };
type DvCreateResult = { id: string };

// ── Cola de escrituras (serializa create/update/delete) ─────────────────────
let _writeQueue: Promise<unknown> = Promise.resolve();

function enqueueWrite<T>(op: () => Promise<T>): Promise<T> {
  const next = _writeQueue.then(() => op(), () => op());
  _writeQueue = next.catch(() => undefined);
  return next;
}

// ── API pública ───────────────────────────────────────────────────────────────
/** Lectura de múltiples registros. Paralela (sin cola). */
export const sdkGet = async (
  entity: string,
  options?: string,
): Promise<DvResult> => {
  const entitySet = toEntitySet(entity);
  const result = await getSdkClient().retrieveMultipleRecordsAsync<DvRecord>(
    entitySet,
    parseOData(options),
  );
  if (!result.success) {
    const msg = result.error?.message ?? `[dataverseSdk] GET ${entity} falló`;
    console.error(`[dataverseSdk] GET ${entitySet} FAILED:`, result.error);
    throw new Error(msg);
  }
  return { entities: result.data ?? [] };
};

/** Lectura de un registro por GUID. Paralela (sin cola). */
export const sdkGetOne = async (
  entity: string,
  id: string,
  options?: string,
): Promise<DvRecord> => {
  const result = await getSdkClient().retrieveRecordAsync<DvRecord>(
    toEntitySet(entity),
    id,
    parseOData(options),
  );
  if (!result.success) {
    throw new Error(result.error?.message ?? `[dataverseSdk] GET ${entity}(${id}) falló`);
  }
  return result.data;
};

/** Creación de registro. Serializada. */
export const sdkCreate = (
  entity: string,
  data: DvRecord,
): Promise<DvCreateResult> =>
  enqueueWrite(async () => {
    const result = await getSdkClient().createRecordAsync<DvRecord, DvRecord>(
      toEntitySet(entity),
      data,
    );
    if (!result.success) {
      throw new Error(result.error?.message ?? `[dataverseSdk] CREATE ${entity} falló`);
    }
    // El SDK devuelve el registro creado; extraemos la PK ({logicalName}id)
    const pk = pkField(entity);
    const id = ((result.data?.[pk] ?? result.data?.id ?? "") as string);
    return { id };
  });

/** Actualización de registro. Serializada. */
export const sdkUpdate = (
  entity: string,
  id: string,
  data: DvRecord,
): Promise<DvCreateResult> =>
  enqueueWrite(async () => {
    const result = await getSdkClient().updateRecordAsync<DvRecord, DvRecord>(
      toEntitySet(entity),
      id,
      data,
    );
    if (!result.success) {
      throw new Error(result.error?.message ?? `[dataverseSdk] UPDATE ${entity}(${id}) falló`);
    }
    return { id };
  });

/** Eliminación de registro. Serializada. */
export const sdkDelete = (
  entity: string,
  id: string,
): Promise<DvCreateResult> =>
  enqueueWrite(async () => {
    const result = await getSdkClient().deleteRecordAsync(toEntitySet(entity), id);
    if (!result.success) {
      throw new Error(result.error?.message ?? `[dataverseSdk] DELETE ${entity}(${id}) falló`);
    }
    return { id };
  });

/** Subida de archivo a columna File/Image de Dataverse. Serializada. */
export const sdkUploadFile = (
  entity: string,
  id: string,
  columnName: string,
  fileName: string,
  data: string | Uint8Array | ArrayBuffer | Blob,
): Promise<void> =>
  enqueueWrite(async () => {
    const result = await getSdkClient().uploadFileToRecord(
      toEntitySet(entity),
      id,
      columnName,
      fileName,
      data,
    );
    if (!result.success) {
      throw new Error(result.error?.message ?? `[dataverseSdk] UPLOAD FILE ${entity}(${id}) falló`);
    }
  });

/** Descarga de archivo desde columna File/Image de Dataverse. Paralela (sin cola). */
export const sdkDownloadFile = async (
  entity: string,
  id: string,
  columnName: string,
): Promise<Uint8Array> => {
  const result = await getSdkClient().downloadFileFromRecord(
    toEntitySet(entity),
    id,
    columnName,
  );
  if (!result.success) {
    throw new Error(result.error?.message ?? `[dataverseSdk] DOWNLOAD FILE ${entity}(${id}) falló`);
  }
  return result.data;
};
