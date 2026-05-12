// ─────────────────────────────────────────────────────────
//  src/screens/gantt/tokens.ts
//  Tokens visuales: colores por estado, prioridad y tipo
// ─────────────────────────────────────────────────────────

/** Color de chip y barra por stateId */
export interface StateColor {
  bg: string;
  text: string;
  bar: string;          // color principal de la barra
  barProgress: string;  // color del overlay de progreso
}

export const STATE_COLORS: Record<string, StateColor> = {
  "st-new":  { bg: "#EFF6FC", text: "#0078D4", bar: "#C7E0F4", barProgress: "#0078D4" },
  "st-ref":  { bg: "#F3F9FD", text: "#2899F5", bar: "#BDD8F6", barProgress: "#2899F5" },
  "st-prog": { bg: "#E7F7E7", text: "#107C10", bar: "#BAE0BA", barProgress: "#107C10" },
  "st-blk":  { bg: "#FDE7E9", text: "#A4262C", bar: "#F4B8BB", barProgress: "#D13438" },
  "st-rft":  { bg: "#FFF4CE", text: "#835B00", bar: "#F4D180", barProgress: "#CA8B00" },
  "st-test": { bg: "#EFF6FC", text: "#0078D4", bar: "#C7E0F4", barProgress: "#0078D4" },
  "st-acc":  { bg: "#DDFCE5", text: "#107C10", bar: "#9EE59E", barProgress: "#107C10" },
  "st-cls":  { bg: "#F3F2F1", text: "#605E5C", bar: "#D6D4D3", barProgress: "#A19F9D" },
};

export const DEFAULT_STATE_COLOR: StateColor = {
  bg: "#F3F2F1", text: "#605E5C", bar: "#D6D4D3", barProgress: "#A19F9D",
};

export const getStateColor = (stateId: string): StateColor =>
  STATE_COLORS[stateId] ?? DEFAULT_STATE_COLOR;

/** Color de chip de prioridad */
export const PRIORITY_COLORS: Record<string, { bg: string; text: string }> = {
  "Alta":  { bg: "#FDE7E9", text: "#A4262C" },
  "Media": { bg: "#FFF4CE", text: "#835B00" },
  "Baja":  { bg: "#F3F2F1", text: "#605E5C" },
};

/** Color de chip de tipo de WorkItem */
export const TYPE_COLORS: Record<string, { bg: string; text: string }> = {
  "Feature":  { bg: "#EFF6FC", text: "#0078D4" },
  "Bug":      { bg: "#FDE7E9", text: "#A4262C" },
  "TechDebt": { bg: "#FDF6F0", text: "#8B3800" },
  "Spike":    { bg: "#F3EFF7", text: "#7530AF" },
};

/** Color de chip de assignedToRole */
export const ROLE_COLORS: Record<string, { bg: string; text: string }> = {
  "Admin":        { bg: "#F3F2F1", text: "#323130" },
  "IT AirEuropa": { bg: "#EFF6FC", text: "#0078D4" },
  "Proveedor":    { bg: "#FFF4CE", text: "#835B00" },
  "Usuario":      { bg: "#E7F7E7", text: "#107C10" },
};
