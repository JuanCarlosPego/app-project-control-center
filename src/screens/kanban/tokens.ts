// ─────────────────────────────────────────────────────────
//  src/screens/kanban/tokens.ts
//  Tokens visuales del Kanban: colores por estado, col config
// ─────────────────────────────────────────────────────────

export interface ColumnDef {
  stateId: string;
  label: string;
  accent: string;    // color borde columna
  headerBg: string;  // fondo chip counter
  bg: string;        // fondo columna
}

/** Configuración de columnas del Kanban — solo estados de EJECUCIÓN.
 *  st-new y st-ref pertenecen al Backlog y nunca se muestran aquí. */
export const KANBAN_COLUMNS: ColumnDef[] = [
  { stateId: "st-prog", label: "En curso",            accent: "#107C10", headerBg: "#E7F7E7", bg: "#F5FCF5" },
  { stateId: "st-blk",  label: "Bloqueado",           accent: "#D13438", headerBg: "#FDE7E9", bg: "#FFF6F6" },
  { stateId: "st-rft",  label: "Listo para pruebas",  accent: "#CA8B00", headerBg: "#FFF4CE", bg: "#FFFDF0" },
  { stateId: "st-test", label: "En pruebas",          accent: "#7530AF", headerBg: "#F3EFF7", bg: "#FBF8FF" },
  { stateId: "st-acc",  label: "Aceptado",            accent: "#00B294", headerBg: "#DDFCE5", bg: "#F4FFFD" },
  { stateId: "st-cls",  label: "Cerrado",             accent: "#605E5C", headerBg: "#F3F2F1", bg: "#FAFAFA" },
];

/** Colores de chip de estado */
export const STATE_CHIP: Record<string, { bg: string; text: string }> = {
  "st-new":  { bg: "#F3F2F1", text: "#605E5C" },
  "st-ref":  { bg: "#EFF6FC", text: "#0078D4" },
  "st-prog": { bg: "#E7F7E7", text: "#107C10" },
  "st-blk":  { bg: "#FDE7E9", text: "#A4262C" },
  "st-rft":  { bg: "#FFF4CE", text: "#835B00" },
  "st-test": { bg: "#F3EFF7", text: "#7530AF" },
  "st-acc":  { bg: "#DDFCE5", text: "#107C10" },
  "st-cls":  { bg: "#F3F2F1", text: "#A19F9D" },
};

/** Colores de chip de prioridad */
export const PRIORITY_CHIP: Record<string, { bg: string; text: string }> = {
  "Alta":  { bg: "#FDE7E9", text: "#A4262C" },
  "Media": { bg: "#FFF4CE", text: "#835B00" },
  "Baja":  { bg: "#F3F2F1", text: "#605E5C" },
};

/** Colores de chip de tipo */
export const TYPE_CHIP: Record<string, { bg: string; text: string }> = {
  "Feature":  { bg: "#EFF6FC", text: "#0078D4" },
  "Bug":      { bg: "#FDE7E9", text: "#A4262C" },
  "TechDebt": { bg: "#FDF6F0", text: "#8B3800" },
  "Spike":    { bg: "#F3EFF7", text: "#7530AF" },
};

/** Colores de chip de rol */
export const ROLE_CHIP: Record<string, { bg: string; text: string }> = {
  "Admin":        { bg: "#F3F2F1", text: "#323130" },
  "IT AirEuropa": { bg: "#EFF6FC", text: "#0078D4" },
  "Proveedor":    { bg: "#FFF4CE", text: "#835B00" },
  "Usuario":      { bg: "#E7F7E7", text: "#107C10" },
};

/** Colores del badge de sync */
export const SYNC_CHIP: Record<string, { bg: string; text: string; label: string }> = {
  "OK":      { bg: "#DFF6DD", text: "#107C10", label: "Sync OK" },
  "Pending": { bg: "#FFF4CE", text: "#835B00", label: "Sincronizando…" },
  "Error":   { bg: "#FDE7E9", text: "#A4262C", label: "Sync Error" },
};
